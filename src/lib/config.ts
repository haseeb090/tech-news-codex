import path from "node:path";
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

const rssFeeds = process.env.RSS_FEEDS
  ? process.env.RSS_FEEDS.split(",").map((item) => item.trim()).filter(Boolean)
  : defaultFeeds;

export const appConfig = {
  appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
  authSecret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-secret-change-me",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen3:8b",
  curatedRssFeeds: curatedFeeds,
  rssFeeds,
  maxArticlesInExport: parseIntWithDefault(process.env.MAX_ARTICLES_IN_EXPORT, 100),
  maxRetries: parseIntWithDefault(process.env.INGEST_MAX_RETRIES, 3),
  retryCooldownMinutes: parseIntWithDefault(process.env.INGEST_RETRY_COOLDOWN_MINUTES, 30),
  ingestionConcurrency: parseIntWithDefault(process.env.INGEST_CONCURRENCY, 4),
  workerIntervalMinutes: parseIntWithDefault(process.env.WORKER_INTERVAL_MINUTES, 60),
  useLlmFallback: parseBoolean(process.env.USE_LLM_FALLBACK, true),
  dataDirectory: path.resolve(process.cwd(), "data"),
  dbPath: path.resolve(process.cwd(), "data", "news.db"),
  csvExportPath: path.resolve(process.cwd(), "data", "news-latest.csv"),
  jsonExportPath: path.resolve(process.cwd(), "public", "news-latest.json"),
};

export const isProduction = process.env.NODE_ENV === "production";
