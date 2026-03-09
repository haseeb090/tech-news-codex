import fs from "node:fs";
import Database from "better-sqlite3";

import { appConfig } from "@/lib/config";
import type { ArticleRecord, ExtractedArticle, IngestionRunSummary, LinkRecord } from "@/lib/types";

let db: Database.Database | null = null;

const nowIso = (): string => new Date().toISOString();

const mapLink = (row: Record<string, unknown>): LinkRecord => ({
  id: Number(row.id),
  feedUrl: String(row.feed_url),
  originalUrl: String(row.original_url),
  normalizedUrl: String(row.normalized_url),
  sourceDomain: String(row.source_domain),
  status: row.status as LinkRecord["status"],
  retryCount: Number(row.retry_count),
  nextRetryAt: (row.next_retry_at as string | null) || null,
  articleId: (row.article_id as number | null) || null,
  lastError: (row.last_error as string | null) || null,
  firstSeenAt: String(row.first_seen_at),
  lastSeenAt: String(row.last_seen_at),
});

const mapArticle = (row: Record<string, unknown>): ArticleRecord => ({
  id: Number(row.id),
  linkId: Number(row.link_id),
  canonicalUrl: String(row.canonical_url),
  sourceDomain: String(row.source_domain),
  title: String(row.title),
  body: String(row.body),
  writer: (row.writer as string | null) || null,
  publishedAt: (row.published_at as string | null) || null,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const ensureInitialized = (): Database.Database => {
  if (db) return db;

  fs.mkdirSync(appConfig.dataDirectory, { recursive: true });

  db = new Database(appConfig.dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      url TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS article_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url TEXT NOT NULL,
      original_url TEXT NOT NULL,
      normalized_url TEXT NOT NULL UNIQUE,
      source_domain TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      article_id INTEGER,
      last_error TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(feed_url) REFERENCES feeds(url)
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL UNIQUE,
      canonical_url TEXT NOT NULL UNIQUE,
      source_domain TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      writer TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(link_id) REFERENCES article_links(id)
    );

    CREATE TABLE IF NOT EXISTS ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      total_links INTEGER NOT NULL,
      new_links INTEGER NOT NULL,
      queued_for_processing INTEGER NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      succeeded INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS article_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      link_id INTEGER NOT NULL,
      article_url TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      model_used TEXT,
      duration_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES ingest_runs(id),
      FOREIGN KEY(link_id) REFERENCES article_links(id)
    );

    CREATE INDEX IF NOT EXISTS idx_article_links_status ON article_links(status);
    CREATE INDEX IF NOT EXISTS idx_article_links_retry ON article_links(next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at);
  `);

  return db;
};

export const getDb = (): Database.Database => ensureInitialized();

export const registerFeedIfMissing = (feedUrl: string): void => {
  const database = ensureInitialized();
  const now = nowIso();

  database
    .prepare(
      `
      INSERT INTO feeds (url, created_at, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET updated_at = excluded.updated_at
      `,
    )
    .run(feedUrl, now, now);
};

export const upsertDiscoveredLink = (
  feedUrl: string,
  originalUrl: string,
  normalizedUrl: string,
  sourceDomain: string,
): { link: LinkRecord; isNew: boolean } => {
  const database = ensureInitialized();
  const now = nowIso();

  const existing = database
    .prepare("SELECT * FROM article_links WHERE normalized_url = ?")
    .get(normalizedUrl) as Record<string, unknown> | undefined;

  if (!existing) {
    const inserted = database
      .prepare(
        `
        INSERT INTO article_links (
          feed_url,
          original_url,
          normalized_url,
          source_domain,
          status,
          first_seen_at,
          last_seen_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)
        RETURNING *
        `,
      )
      .get(feedUrl, originalUrl, normalizedUrl, sourceDomain, now, now, now) as Record<string, unknown>;

    return { link: mapLink(inserted), isNew: true };
  }

  database
    .prepare(
      `
      UPDATE article_links
      SET original_url = ?,
          feed_url = ?,
          source_domain = ?,
          last_seen_at = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .run(originalUrl, feedUrl, sourceDomain, now, now, existing.id);

  const refreshed = database
    .prepare("SELECT * FROM article_links WHERE id = ?")
    .get(existing.id) as Record<string, unknown>;

  return { link: mapLink(refreshed), isNew: false };
};

export const isLinkEligibleForProcessing = (link: LinkRecord): boolean => {
  if (link.status === "queued") return true;
  if (link.status === "success") return false;

  if (link.status === "failed") {
    if (link.retryCount >= appConfig.maxRetries) return false;
    if (!link.nextRetryAt) return true;
    return new Date(link.nextRetryAt).getTime() <= Date.now();
  }

  return false;
};

export const startIngestRun = (
  trigger: IngestionRunSummary["trigger"],
  totalLinks: number,
  newLinks: number,
  queuedForProcessing: number,
): number => {
  const database = ensureInitialized();

  const result = database
    .prepare(
      `
      INSERT INTO ingest_runs (trigger, started_at, total_links, new_links, queued_for_processing)
      VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(trigger, nowIso(), totalLinks, newLinks, queuedForProcessing);

  return Number(result.lastInsertRowid);
};

export const finalizeIngestRun = (summary: IngestionRunSummary): void => {
  const database = ensureInitialized();

  database
    .prepare(
      `
      UPDATE ingest_runs
      SET finished_at = ?,
          processed = ?,
          succeeded = ?,
          failed = ?
      WHERE id = ?
      `,
    )
    .run(summary.finishedAt, summary.processed, summary.succeeded, summary.failed, summary.runId);
};

export const recordAttempt = (params: {
  runId: number;
  linkId: number;
  articleUrl: string;
  status: "success" | "failed";
  errorMessage?: string;
  modelUsed?: string;
  durationMs: number;
}): void => {
  const database = ensureInitialized();

  database
    .prepare(
      `
      INSERT INTO article_attempts (
        run_id,
        link_id,
        article_url,
        status,
        error_message,
        model_used,
        duration_ms,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      params.runId,
      params.linkId,
      params.articleUrl,
      params.status,
      params.errorMessage || null,
      params.modelUsed || null,
      params.durationMs,
      nowIso(),
    );
};

export const persistSuccessfulArticle = (params: {
  linkId: number;
  normalizedUrl: string;
  sourceDomain: string;
  extracted: ExtractedArticle;
}): number => {
  const database = ensureInitialized();
  const now = nowIso();

  const existing = database
    .prepare("SELECT id FROM articles WHERE canonical_url = ?")
    .get(params.normalizedUrl) as { id: number } | undefined;

  let articleId = existing?.id;

  if (articleId) {
    database
      .prepare(
        `
        UPDATE articles
        SET link_id = ?,
            source_domain = ?,
            title = ?,
            body = ?,
            writer = ?,
            published_at = ?,
            updated_at = ?
        WHERE id = ?
        `,
      )
      .run(
        params.linkId,
        params.sourceDomain,
        params.extracted.title,
        params.extracted.body,
        params.extracted.writer,
        params.extracted.publishedAt,
        now,
        articleId,
      );
  } else {
    const inserted = database
      .prepare(
        `
        INSERT INTO articles (
          link_id,
          canonical_url,
          source_domain,
          title,
          body,
          writer,
          published_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        params.linkId,
        params.normalizedUrl,
        params.sourceDomain,
        params.extracted.title,
        params.extracted.body,
        params.extracted.writer,
        params.extracted.publishedAt,
        now,
        now,
      );

    articleId = Number(inserted.lastInsertRowid);
  }

  database
    .prepare(
      `
      UPDATE article_links
      SET status = 'success',
          retry_count = 0,
          next_retry_at = NULL,
          article_id = ?,
          last_error = NULL,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .run(articleId, now, params.linkId);

  return articleId;
};

export const markLinkFailure = (linkId: number, message: string): void => {
  const database = ensureInitialized();

  const link = database
    .prepare("SELECT retry_count FROM article_links WHERE id = ?")
    .get(linkId) as { retry_count: number } | undefined;

  if (!link) return;

  const retryCount = link.retry_count + 1;
  const canRetry = retryCount < appConfig.maxRetries;
  const nextRetry = canRetry
    ? new Date(Date.now() + appConfig.retryCooldownMinutes * 60 * 1000 * Math.max(1, retryCount)).toISOString()
    : null;

  database
    .prepare(
      `
      UPDATE article_links
      SET status = 'failed',
          retry_count = ?,
          next_retry_at = ?,
          last_error = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .run(retryCount, nextRetry, message.slice(0, 1000), nowIso(), linkId);
};

export const getLinksByIds = (ids: number[]): LinkRecord[] => {
  if (ids.length === 0) return [];

  const database = ensureInitialized();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = database
    .prepare(`SELECT * FROM article_links WHERE id IN (${placeholders})`)
    .all(...ids) as Record<string, unknown>[];

  return rows.map(mapLink);
};

export const getLatestArticles = (limit: number): ArticleRecord[] => {
  const database = ensureInitialized();
  const rows = database
    .prepare(
      `
      SELECT *
      FROM articles
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ?
      `,
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map(mapArticle);
};

export const getDistinctSources = (): string[] => {
  const database = ensureInitialized();
  const rows = database
    .prepare("SELECT DISTINCT source_domain FROM articles ORDER BY source_domain ASC")
    .all() as Array<{ source_domain: string }>;

  return rows.map((row) => row.source_domain);
};

export const getLastRun = (): IngestionRunSummary | null => {
  const database = ensureInitialized();
  const row = database
    .prepare("SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 1")
    .get() as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    runId: Number(row.id),
    trigger: String(row.trigger) as IngestionRunSummary["trigger"],
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string) || String(row.started_at),
    totalLinks: Number(row.total_links),
    newLinks: Number(row.new_links),
    queuedForProcessing: Number(row.queued_for_processing),
    processed: Number(row.processed),
    succeeded: Number(row.succeeded),
    failed: Number(row.failed),
  };
};

export const getFailedLinks = (limit = 25): LinkRecord[] => {
  const database = ensureInitialized();
  const rows = database
    .prepare(
      `
      SELECT * FROM article_links
      WHERE status = 'failed'
      ORDER BY updated_at DESC
      LIMIT ?
      `,
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map(mapLink);
};
