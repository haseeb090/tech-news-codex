import curatedFeeds from "@/lib/ingestion/feeds.json";

const defaultFeeds = curatedFeeds.map((feed) => feed.feedUrl);

const parseIntWithDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const resolveUrl = (value: string | undefined, fallback: string): URL => {
  try {
    return new URL(value || fallback);
  } catch {
    return new URL(fallback);
  }
};

const rssFeeds = process.env.RSS_FEEDS
  ? process.env.RSS_FEEDS.split(",").map((item) => item.trim()).filter(Boolean)
  : defaultFeeds;

const production = process.env.NODE_ENV === "production";
const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
const appUrlObject = resolveUrl(process.env.NEXTAUTH_URL, appUrl);
const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (production && !authSecret) {
  throw new Error("NEXTAUTH_SECRET or AUTH_SECRET must be set in production");
}

export const appConfig = {
  appUrl,
  appOrigin: appUrlObject.origin,
  appUrlIsHttps: appUrlObject.protocol === "https:",
  authSecret: authSecret || "dev-secret-change-me",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  adminEnabled: parseBoolean(process.env.ADMIN_ENABLED, !production),
  adminLocalOnly: parseBoolean(process.env.ADMIN_LOCAL_ONLY, true),
  databaseUrl: process.env.DATABASE_URL || "",
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN || "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen3:8b",
  publicSignupEnabled: parseBoolean(process.env.PUBLIC_SIGNUP_ENABLED, true),
  rateLimitingEnabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
  readerLoginRateLimitAttempts: parseIntWithDefault(process.env.READER_LOGIN_RATE_LIMIT_ATTEMPTS, 15),
  readerLoginRateLimitWindowMinutes: parseIntWithDefault(process.env.READER_LOGIN_RATE_LIMIT_WINDOW_MINUTES, 15),
  readerSignupRateLimitAttempts: parseIntWithDefault(process.env.READER_SIGNUP_RATE_LIMIT_ATTEMPTS, 10),
  readerSignupRateLimitWindowMinutes: parseIntWithDefault(process.env.READER_SIGNUP_RATE_LIMIT_WINDOW_MINUTES, 60),
  adminTriggerRateLimitAttempts: parseIntWithDefault(process.env.ADMIN_TRIGGER_RATE_LIMIT_ATTEMPTS, 10),
  adminTriggerRateLimitWindowMinutes: parseIntWithDefault(process.env.ADMIN_TRIGGER_RATE_LIMIT_WINDOW_MINUTES, 1),
  previewArticles: parseIntWithDefault(process.env.PREVIEW_ARTICLE_COUNT, 5),
  viewMoreIncrement: parseIntWithDefault(process.env.VIEW_MORE_INCREMENT, 6),
  curatedRssFeeds: curatedFeeds,
  rssFeeds,
  maxArticlesInExport: parseIntWithDefault(process.env.MAX_ARTICLES_IN_EXPORT, 100),
  maxRetries: parseIntWithDefault(process.env.INGEST_MAX_RETRIES, 3),
  retryCooldownMinutes: parseIntWithDefault(process.env.INGEST_RETRY_COOLDOWN_MINUTES, 30),
  ingestionConcurrency: parseIntWithDefault(process.env.INGEST_CONCURRENCY, 4),
  workerIntervalMinutes: parseIntWithDefault(process.env.WORKER_INTERVAL_MINUTES, 60),
  workerAlignToInterval: parseBoolean(process.env.WORKER_ALIGN_TO_INTERVAL, false),
  workerRunOnStart: parseBoolean(process.env.WORKER_RUN_ON_START, true),
  useLlmFallback: parseBoolean(process.env.USE_LLM_FALLBACK, true),
  articleFetchTimeoutMs: parseIntWithDefault(process.env.ARTICLE_FETCH_TIMEOUT_MS, 20_000),
  articleProcessTimeoutMs: parseIntWithDefault(process.env.ARTICLE_PROCESS_TIMEOUT_MS, 60_000),
  llmHtmlMaxChars: parseIntWithDefault(process.env.LLM_HTML_MAX_CHARS, 45_000),
  articleRecordLimit: parseIntWithDefault(process.env.ARTICLE_RECORD_LIMIT, 9000),
  articlePruneCount: parseIntWithDefault(process.env.ARTICLE_PRUNE_COUNT, 500),
  articleLinkRecordLimit: parseIntWithDefault(process.env.ARTICLE_LINK_RECORD_LIMIT, 12000),
  articleLinkPruneCount: parseIntWithDefault(process.env.ARTICLE_LINK_PRUNE_COUNT, 1000),
  ingestRunRecordLimit: parseIntWithDefault(process.env.INGEST_RUN_RECORD_LIMIT, 200),
  ingestRunPruneCount: parseIntWithDefault(process.env.INGEST_RUN_PRUNE_COUNT, 50),
  ingestAttemptRecordLimit: parseIntWithDefault(process.env.INGEST_ATTEMPT_RECORD_LIMIT, 1200),
  ingestAttemptPruneCount: parseIntWithDefault(process.env.INGEST_ATTEMPT_PRUNE_COUNT, 250),
  ingestEventRecordLimit: parseIntWithDefault(process.env.INGEST_EVENT_RECORD_LIMIT, 5000),
  ingestEventPruneCount: parseIntWithDefault(process.env.INGEST_EVENT_PRUNE_COUNT, 1000),
  loginAuditRecordLimit: parseIntWithDefault(process.env.LOGIN_AUDIT_RECORD_LIMIT, 500),
  loginAuditPruneCount: parseIntWithDefault(process.env.LOGIN_AUDIT_PRUNE_COUNT, 100),
  dataDirectory: "data",
  csvExportPath: "data/news-latest.csv",
  jsonExportPath: "public/news-latest.json",
};

export const isProduction = production;
