import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { getDb, closeDb as closeLibsql } from "@/db/client";
import { appLocks, articleAttempts, articleLinks, articles, feeds, ingestRuns, loginAudit, rateLimits } from "@/db/schema";
import { appConfig } from "@/lib/config";
import { buildRetryPlan } from "@/lib/ingestion/retry-policy";
import { getSourcePolicy } from "@/lib/ingestion/source-policy";
import type {
  ArticleAttemptRecord,
  ArticleRecord,
  ExtractedArticle,
  IngestionRunRecord,
  IngestionRunSummary,
  LinkRecord,
} from "@/lib/types";

type DbClient = ReturnType<typeof getDb>;
type TxClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const nowDate = (): Date => new Date();

const toIso = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  return value.toISOString();
};

const mapLink = (row: typeof articleLinks.$inferSelect): LinkRecord => ({
  id: row.id,
  feedUrl: row.feedUrl,
  originalUrl: row.originalUrl,
  normalizedUrl: row.normalizedUrl,
  sourceDomain: row.sourceDomain,
  status: row.status as LinkRecord["status"],
  retryCount: row.retryCount,
  nextRetryAt: toIso(row.nextRetryAt),
  articleId: row.articleId,
  lastError: row.lastError,
  firstSeenAt: row.firstSeenAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
});

const mapArticle = (row: typeof articles.$inferSelect): ArticleRecord => ({
  id: row.id,
  linkId: row.linkId,
  canonicalUrl: row.canonicalUrl,
  sourceDomain: row.sourceDomain,
  title: row.title,
  body: row.body,
  writer: row.writer,
  publishedAt: toIso(row.publishedAt),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const mapRun = (row: typeof ingestRuns.$inferSelect): IngestionRunRecord => ({
  runId: row.id,
  trigger: row.trigger as IngestionRunSummary["trigger"],
  startedAt: row.startedAt.toISOString(),
  finishedAt: toIso(row.finishedAt) || row.startedAt.toISOString(),
  totalLinks: row.totalLinks,
  newLinks: row.newLinks,
  queuedForProcessing: row.queuedForProcessing,
  processed: row.processed,
  succeeded: row.succeeded,
  failed: row.failed,
  status: row.status as IngestionRunRecord["status"],
  currentItemUrl: row.currentItemUrl,
  lastError: row.lastError,
});

const mapAttempt = (row: typeof articleAttempts.$inferSelect): ArticleAttemptRecord => ({
  id: row.id,
  runId: row.runId,
  linkId: row.linkId,
  articleUrl: row.articleUrl,
  status: row.status as ArticleAttemptRecord["status"],
  errorMessage: row.errorMessage,
  modelUsed: row.modelUsed,
  agentOutput: row.agentOutput,
  durationMs: row.durationMs,
  createdAt: row.createdAt.toISOString(),
});

const countRows = async (
  dbLike: Pick<DbClient, "select"> | Pick<TxClient, "select">,
  table: typeof articles | typeof articleLinks | typeof ingestRuns | typeof articleAttempts | typeof loginAudit,
): Promise<number> => {
  const rows = await dbLike.select({ count: sql<number>`count(*)` }).from(table);
  return Number(rows[0]?.count || 0);
};

const pruneArticlesIfNeeded = async (tx: TxClient) => {
  const count = await countRows(tx, articles);
  if (count + 1 <= appConfig.articleRecordLimit) return;

  const oldestArticles = await tx
    .select({ id: articles.id, linkId: articles.linkId })
    .from(articles)
    .orderBy(asc(articles.createdAt))
    .limit(appConfig.articlePruneCount);

  if (oldestArticles.length === 0) return;

  await tx.delete(articles).where(inArray(articles.id, oldestArticles.map((row) => row.id)));
  await tx.delete(articleLinks).where(inArray(articleLinks.id, oldestArticles.map((row) => row.linkId)));
};

const pruneLinkQueueIfNeeded = async (tx: TxClient) => {
  const count = await countRows(tx, articleLinks);
  if (count + 1 <= appConfig.articleLinkRecordLimit) return;

  const removable = await tx
    .select({ id: articleLinks.id })
    .from(articleLinks)
    .where(or(isNull(articleLinks.articleId), eq(articleLinks.status, "failed")))
    .orderBy(asc(articleLinks.firstSeenAt))
    .limit(appConfig.articleLinkPruneCount);

  if (removable.length === 0) return;
  await tx.delete(articleLinks).where(inArray(articleLinks.id, removable.map((row) => row.id)));
};

const pruneIngestRunsIfNeeded = async (tx: TxClient) => {
  const count = await countRows(tx, ingestRuns);
  if (count + 1 <= appConfig.ingestRunRecordLimit) return;

  const removable = await tx
    .select({ id: ingestRuns.id })
    .from(ingestRuns)
    .orderBy(asc(ingestRuns.startedAt))
    .limit(appConfig.ingestRunPruneCount);

  if (removable.length === 0) return;

  const runIds = removable.map((row) => row.id);
  await tx.delete(articleAttempts).where(inArray(articleAttempts.runId, runIds));
  await tx.delete(ingestRuns).where(inArray(ingestRuns.id, runIds));
};

const pruneAttemptsIfNeeded = async (tx: TxClient) => {
  const count = await countRows(tx, articleAttempts);
  if (count + 1 <= appConfig.ingestAttemptRecordLimit) return;

  const removable = await tx
    .select({ id: articleAttempts.id })
    .from(articleAttempts)
    .orderBy(asc(articleAttempts.createdAt))
    .limit(appConfig.ingestAttemptPruneCount);

  if (removable.length === 0) return;
  await tx.delete(articleAttempts).where(inArray(articleAttempts.id, removable.map((row) => row.id)));
};

const pruneLoginAuditIfNeeded = async (tx: TxClient) => {
  const count = await countRows(tx, loginAudit);
  if (count + 1 <= appConfig.loginAuditRecordLimit) return;

  const removable = await tx
    .select({ id: loginAudit.id })
    .from(loginAudit)
    .orderBy(asc(loginAudit.createdAt))
    .limit(appConfig.loginAuditPruneCount);

  if (removable.length === 0) return;
  await tx.delete(loginAudit).where(inArray(loginAudit.id, removable.map((row) => row.id)));
};

export const closeDb = async (): Promise<void> => {
  await closeLibsql();
};

export const registerFeedIfMissing = async (feedUrl: string): Promise<void> => {
  const db = getDb();
  const now = nowDate();

  await db
    .insert(feeds)
    .values({
      url: feedUrl,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: feeds.url,
      set: { updatedAt: now },
    });
};

export const upsertDiscoveredLink = async (
  feedUrl: string,
  originalUrl: string,
  normalizedUrl: string,
  sourceDomain: string,
): Promise<{ link: LinkRecord; isNew: boolean }> => {
  const db = getDb();
  const now = nowDate();

  const existing = await db
    .select()
    .from(articleLinks)
    .where(eq(articleLinks.normalizedUrl, normalizedUrl))
    .limit(1);

  if (existing.length === 0) {
    return db.transaction(async (tx) => {
      await pruneLinkQueueIfNeeded(tx);

      const inserted = await tx
        .insert(articleLinks)
        .values({
          feedUrl,
          originalUrl,
          normalizedUrl,
          sourceDomain,
          status: "queued",
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
        })
        .returning();

      return { link: mapLink(inserted[0]), isNew: true };
    });
  }

  await db
    .update(articleLinks)
    .set({
      feedUrl,
      originalUrl,
      sourceDomain,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(eq(articleLinks.id, existing[0].id));

  const refreshed = await db.select().from(articleLinks).where(eq(articleLinks.id, existing[0].id)).limit(1);
  return { link: mapLink(refreshed[0]), isNew: false };
};

export const isLinkEligibleForProcessing = (link: LinkRecord): boolean => {
  const sourcePolicy = getSourcePolicy(link.normalizedUrl || link.sourceDomain);

  if (link.status === "queued") return true;
  if (link.status === "success") return false;

  if (link.status === "failed") {
    if (link.retryCount >= sourcePolicy.maxRetries) return false;
    if (!link.nextRetryAt) return true;
    return new Date(link.nextRetryAt).getTime() <= Date.now();
  }

  return false;
};

export const startIngestRun = async (
  trigger: IngestionRunSummary["trigger"],
  totalLinks = 0,
  newLinks = 0,
  queuedForProcessing = 0,
): Promise<number> => {
  const db = getDb();
  const now = nowDate();

  return db.transaction(async (tx) => {
    await pruneIngestRunsIfNeeded(tx);

    const inserted = await tx
      .insert(ingestRuns)
      .values({
        trigger,
        startedAt: now,
        totalLinks,
        newLinks,
        queuedForProcessing,
        status: "running",
      })
      .returning({ id: ingestRuns.id });

    return inserted[0].id;
  });
};

export const updateIngestRunDiscovery = async (
  runId: number,
  details: { totalLinks: number; newLinks: number; queuedForProcessing: number },
): Promise<void> => {
  const db = getDb();
  await db
    .update(ingestRuns)
    .set({
      totalLinks: details.totalLinks,
      newLinks: details.newLinks,
      queuedForProcessing: details.queuedForProcessing,
    })
    .where(eq(ingestRuns.id, runId));
};

export const updateIngestRunProgress = async (
  runId: number,
  progress: { processed: number; succeeded: number; failed: number; currentItemUrl?: string | null },
): Promise<void> => {
  const db = getDb();
  await db
    .update(ingestRuns)
    .set({
      processed: progress.processed,
      succeeded: progress.succeeded,
      failed: progress.failed,
      currentItemUrl: progress.currentItemUrl || null,
    })
    .where(eq(ingestRuns.id, runId));
};

export const finalizeIngestRun = async (summary: IngestionRunSummary): Promise<void> => {
  const db = getDb();
  await db
    .update(ingestRuns)
    .set({
      finishedAt: new Date(summary.finishedAt),
      processed: summary.processed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      status: "completed",
      currentItemUrl: null,
    })
    .where(eq(ingestRuns.id, summary.runId));
};

export const failIngestRun = async (runId: number, errorMessage: string): Promise<void> => {
  const db = getDb();
  await db
    .update(ingestRuns)
    .set({
      finishedAt: nowDate(),
      status: "failed",
      currentItemUrl: null,
      lastError: errorMessage.slice(0, 1000),
    })
    .where(eq(ingestRuns.id, runId));
};

export const failStaleIngestRuns = async (errorMessage: string): Promise<void> => {
  const db = getDb();
  await db
    .update(ingestRuns)
    .set({
      finishedAt: nowDate(),
      status: "failed",
      currentItemUrl: null,
      lastError: errorMessage.slice(0, 1000),
    })
    .where(eq(ingestRuns.status, "running"));
};

export const recordAttempt = async (params: {
  runId: number;
  linkId: number;
  articleUrl: string;
  status: "success" | "failed";
  errorMessage?: string;
  modelUsed?: string;
  agentOutput?: Record<string, unknown> | null;
  durationMs: number;
}): Promise<void> => {
  const db = getDb();

  await db.transaction(async (tx) => {
    await pruneAttemptsIfNeeded(tx);
    await tx.insert(articleAttempts).values({
      runId: params.runId,
      linkId: params.linkId,
      articleUrl: params.articleUrl,
      status: params.status,
      errorMessage: params.errorMessage || null,
      modelUsed: params.modelUsed || null,
      agentOutput: params.agentOutput || null,
      durationMs: params.durationMs,
      createdAt: nowDate(),
    });
  });
};

export const persistSuccessfulArticle = async (params: {
  linkId: number;
  normalizedUrl: string;
  sourceDomain: string;
  extracted: ExtractedArticle;
  modelUsed?: string | null;
}): Promise<number> => {
  const db = getDb();
  const now = nowDate();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.canonicalUrl, params.normalizedUrl))
      .limit(1);

    let articleId = existing[0]?.id;

    if (articleId) {
      await tx
        .update(articles)
        .set({
          linkId: params.linkId,
          sourceDomain: params.sourceDomain,
          title: params.extracted.title,
          body: params.extracted.body,
          writer: params.extracted.writer,
          publishedAt: params.extracted.publishedAt ? new Date(params.extracted.publishedAt) : null,
          modelUsed: params.modelUsed || null,
          updatedAt: now,
        })
        .where(eq(articles.id, articleId));
    } else {
      await pruneArticlesIfNeeded(tx);

      const inserted = await tx
        .insert(articles)
        .values({
          linkId: params.linkId,
          canonicalUrl: params.normalizedUrl,
          sourceDomain: params.sourceDomain,
          title: params.extracted.title,
          body: params.extracted.body,
          writer: params.extracted.writer,
          publishedAt: params.extracted.publishedAt ? new Date(params.extracted.publishedAt) : null,
          modelUsed: params.modelUsed || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: articles.id });

      articleId = inserted[0].id;
    }

    await tx
      .update(articleLinks)
      .set({
        status: "success",
        retryCount: 0,
        nextRetryAt: null,
        articleId,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(articleLinks.id, params.linkId));

    return articleId;
  });
};

export const markLinkFailure = async (linkId: number, message: string): Promise<void> => {
  const db = getDb();
  const link = await db
    .select({
      retryCount: articleLinks.retryCount,
      normalizedUrl: articleLinks.normalizedUrl,
      sourceDomain: articleLinks.sourceDomain,
    })
    .from(articleLinks)
    .where(eq(articleLinks.id, linkId))
    .limit(1);

  if (link.length === 0) return;

  const retryPlan = buildRetryPlan({
    currentRetryCount: link[0].retryCount,
    errorMessage: message,
    urlOrDomain: link[0].normalizedUrl || link[0].sourceDomain,
  });

  await db
    .update(articleLinks)
    .set({
      status: "failed",
      retryCount: retryPlan.retryCount,
      nextRetryAt: retryPlan.nextRetryAt,
      lastError: message.slice(0, 1000),
      updatedAt: nowDate(),
    })
    .where(eq(articleLinks.id, linkId));
};

export const getLinksByIds = async (ids: number[]): Promise<LinkRecord[]> => {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db.select().from(articleLinks).where(inArray(articleLinks.id, ids));
  return rows.map(mapLink);
};

export const getLatestArticles = async (limit: number): Promise<ArticleRecord[]> => {
  const db = getDb();
  const rows = await db.select().from(articles).orderBy(desc(articles.publishedAt), desc(articles.createdAt)).limit(limit);
  return rows.map(mapArticle);
};

export const getArticleById = async (id: number): Promise<ArticleRecord | null> => {
  const db = getDb();
  const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return rows[0] ? mapArticle(rows[0]) : null;
};

export const getDistinctSources = async (): Promise<string[]> => {
  const db = getDb();
  const rows = await db.selectDistinct({ sourceDomain: articles.sourceDomain }).from(articles).orderBy(asc(articles.sourceDomain));
  return rows.map((row) => row.sourceDomain);
};

export const getLastRun = async (): Promise<IngestionRunRecord | null> => {
  const db = getDb();
  const rows = await db.select().from(ingestRuns).orderBy(desc(ingestRuns.id)).limit(1);
  return rows[0] ? mapRun(rows[0]) : null;
};

export const getActiveRun = async (): Promise<IngestionRunRecord | null> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(ingestRuns)
    .where(eq(ingestRuns.status, "running"))
    .orderBy(desc(ingestRuns.id))
    .limit(1);
  return rows[0] ? mapRun(rows[0]) : null;
};

export const getFailedLinks = async (limit = 25): Promise<LinkRecord[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(articleLinks)
    .where(eq(articleLinks.status, "failed"))
    .orderBy(desc(articleLinks.updatedAt))
    .limit(limit);
  return rows.map(mapLink);
};

export const getRecentAttempts = async (limit = 25): Promise<ArticleAttemptRecord[]> => {
  const db = getDb();
  const rows = await db.select().from(articleAttempts).orderBy(desc(articleAttempts.createdAt)).limit(limit);
  return rows.map(mapAttempt);
};

export const acquireAppLock = async (name: string, ownerId: string, ttlMs: number): Promise<boolean> => {
  const db = getDb();
  const now = nowDate();
  const expiresAt = new Date(now.getTime() + ttlMs);

  return db.transaction(async (tx) => {
    await tx.delete(appLocks).where(lte(appLocks.expiresAt, now));

    const existing = await tx
      .select({ ownerId: appLocks.ownerId })
      .from(appLocks)
      .where(eq(appLocks.name, name))
      .limit(1);

    if (existing[0] && existing[0].ownerId !== ownerId) {
      return false;
    }

    await tx
      .insert(appLocks)
      .values({
        name,
        ownerId,
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appLocks.name,
        set: {
          ownerId,
          expiresAt,
          updatedAt: now,
        },
      });

    return true;
  });
};

export const renewAppLock = async (name: string, ownerId: string, ttlMs: number): Promise<void> => {
  const db = getDb();
  const now = nowDate();
  await db
    .update(appLocks)
    .set({
      expiresAt: new Date(now.getTime() + ttlMs),
      updatedAt: now,
    })
    .where(and(eq(appLocks.name, name), eq(appLocks.ownerId, ownerId)));
};

export const releaseAppLock = async (name: string, ownerId: string): Promise<void> => {
  const db = getDb();
  await db.delete(appLocks).where(and(eq(appLocks.name, name), eq(appLocks.ownerId, ownerId)));
};

export const hasActiveAppLock = async (name: string): Promise<boolean> => {
  const db = getDb();
  const rows = await db
    .select({ name: appLocks.name })
    .from(appLocks)
    .where(and(eq(appLocks.name, name), gt(appLocks.expiresAt, nowDate())))
    .limit(1);

  return rows.length > 0;
};

export const checkRateLimit = async (
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
  const db = getDb();
  const now = Date.now();
  const nowValue = new Date(now);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ count: rateLimits.count, resetAt: rateLimits.resetAt })
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .limit(1);

    if (!existing[0] || existing[0].resetAt.getTime() <= now) {
      const resetAt = now + windowMs;
      await tx
        .insert(rateLimits)
        .values({
          key,
          count: 1,
          resetAt: new Date(resetAt),
          updatedAt: nowValue,
        })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: {
            count: 1,
            resetAt: new Date(resetAt),
            updatedAt: nowValue,
          },
        });

      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
    }

    if (existing[0].count >= limit) {
      return { allowed: false, remaining: 0, resetAt: existing[0].resetAt.getTime() };
    }

    const nextCount = existing[0].count + 1;
    await tx
      .update(rateLimits)
      .set({
        count: nextCount,
        updatedAt: nowValue,
      })
      .where(eq(rateLimits.key, key));

    return {
      allowed: true,
      remaining: Math.max(0, limit - nextCount),
      resetAt: existing[0].resetAt.getTime(),
    };
  });
};

export const recordLoginAudit = async (params: {
  username: string;
  success: boolean;
  reason?: string;
  ipAddress?: string | null;
}): Promise<void> => {
  const db = getDb();

  await db.transaction(async (tx) => {
    await pruneLoginAuditIfNeeded(tx);
    await tx.insert(loginAudit).values({
      username: params.username,
      success: params.success ? 1 : 0,
      reason: params.reason || null,
      ipAddress: params.ipAddress || null,
      createdAt: nowDate(),
    });
  });
};
