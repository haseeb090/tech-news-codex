import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const feeds = sqliteTable("feeds", {
  url: text("url").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const articleLinks = sqliteTable(
  "article_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    feedUrl: text("feed_url").notNull(),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    status: text("status").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
    articleId: integer("article_id"),
    lastError: text("last_error"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    normalizedUrlIdx: uniqueIndex("idx_article_links_normalized_url").on(table.normalizedUrl),
    statusIdx: index("idx_article_links_status").on(table.status),
    retryIdx: index("idx_article_links_retry").on(table.nextRetryAt),
  }),
);

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    linkId: integer("link_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    sourceDomain: text("source_domain").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    writer: text("writer"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    modelUsed: text("model_used"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    linkIdIdx: uniqueIndex("idx_articles_link_id").on(table.linkId),
    canonicalUrlIdx: uniqueIndex("idx_articles_canonical_url").on(table.canonicalUrl),
    createdIdx: index("idx_articles_created").on(table.createdAt),
  }),
);

export const ingestRuns = sqliteTable(
  "ingest_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trigger: text("trigger").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    totalLinks: integer("total_links").notNull().default(0),
    newLinks: integer("new_links").notNull().default(0),
    queuedForProcessing: integer("queued_for_processing").notNull().default(0),
    processed: integer("processed").notNull().default(0),
    succeeded: integer("succeeded").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    status: text("status").notNull().default("completed"),
    currentItemUrl: text("current_item_url"),
    lastError: text("last_error"),
  },
  (table) => ({
    statusIdx: index("idx_ingest_runs_status").on(table.status, table.startedAt),
  }),
);

export const articleAttempts = sqliteTable(
  "article_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    linkId: integer("link_id").notNull(),
    articleUrl: text("article_url").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    modelUsed: text("model_used"),
    agentOutput: text("agent_output", { mode: "json" }).$type<Record<string, unknown> | null>(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    runCreatedIdx: index("idx_attempts_run_created").on(table.runId, table.createdAt),
  }),
);

export const ingestEvents = sqliteTable(
  "ingest_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    linkId: integer("link_id"),
    articleUrl: text("article_url"),
    level: text("level").notNull(),
    stage: text("stage").notNull(),
    message: text("message").notNull(),
    details: text("details", { mode: "json" }).$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    runCreatedIdx: index("idx_ingest_events_run_created").on(table.runId, table.createdAt),
    stageIdx: index("idx_ingest_events_stage").on(table.stage, table.createdAt),
  }),
);

export const appLocks = sqliteTable("app_locks", {
  name: text("name").primaryKey(),
  ownerId: text("owner_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: integer("reset_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    resetIdx: index("idx_rate_limits_reset").on(table.resetAt),
  }),
);

export const loginAudit = sqliteTable(
  "login_audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    success: integer("success").notNull(),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    createdIdx: index("idx_login_audit_created").on(table.createdAt),
  }),
);

export const readerUsers = sqliteTable(
  "reader_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    emailIdx: uniqueIndex("idx_reader_users_email").on(table.email),
    createdIdx: index("idx_reader_users_created").on(table.createdAt),
  }),
);

export const readerSignupEvents = sqliteTable(
  "reader_signup_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),
    email: text("email").notNull(),
    ipAddress: text("ip_address"),
    origin: text("origin"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    createdIdx: index("idx_reader_signup_events_created").on(table.createdAt),
    userCreatedIdx: index("idx_reader_signup_events_user_created").on(table.userId, table.createdAt),
  }),
);
