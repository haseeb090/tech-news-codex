export type LinkStatus = "queued" | "success" | "failed";

export interface LinkRecord {
  id: number;
  feedUrl: string;
  originalUrl: string;
  normalizedUrl: string;
  sourceDomain: string;
  status: LinkStatus;
  retryCount: number;
  nextRetryAt: string | null;
  articleId: number | null;
  lastError: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ArticleRecord {
  id: number;
  linkId: number;
  canonicalUrl: string;
  sourceDomain: string;
  title: string;
  body: string;
  writer: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedArticle {
  title: string;
  body: string;
  writer: string | null;
  publishedAt: string | null;
  context?: string | null;
}

export interface PreparedArticle {
  title: string;
  body: string;
  writer: string | null;
  publishedAt: string | null;
}

export interface IngestionRunSummary {
  runId: number;
  trigger: "manual" | "scheduled" | "startup";
  startedAt: string;
  finishedAt: string;
  totalLinks: number;
  newLinks: number;
  queuedForProcessing: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export interface IngestionRunRecord extends IngestionRunSummary {
  status: "running" | "completed" | "failed";
  currentItemUrl: string | null;
  lastError: string | null;
}

export interface ArticleAttemptRecord {
  id: number;
  runId: number;
  linkId: number;
  articleUrl: string;
  status: "success" | "failed";
  errorMessage: string | null;
  modelUsed: string | null;
  agentOutput: Record<string, unknown> | null;
  durationMs: number;
  createdAt: string;
}

export interface IngestEventRecord {
  id: number;
  runId: number;
  linkId: number | null;
  articleUrl: string | null;
  level: "info" | "warn" | "error";
  stage: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ReaderUserRecord {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface ReaderSignupEventRecord {
  id: number;
  userId: number;
  email: string;
  ipAddress: string | null;
  origin: string | null;
  createdAt: string;
}

export interface NewsQuery {
  q?: string;
  source?: string;
  limit?: number;
}
