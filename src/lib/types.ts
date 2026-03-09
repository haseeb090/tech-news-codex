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

export interface NewsQuery {
  q?: string;
  source?: string;
  limit?: number;
}