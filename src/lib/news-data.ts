import fs from "node:fs/promises";

import { appConfig } from "@/lib/config";
import { getArticleById, getArticleCount, getDistinctSources, queryArticles } from "@/lib/db";
import { getTopicLabel, inferTopics, topicDefinitions } from "@/lib/news-taxonomy";
import type { ArticleRecord } from "@/lib/types";

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const splitSentences = (value: string): string[] =>
  normalizeWhitespace(value)
    .match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

const clampBySentences = (value: string, maxChars: number, minimumSentences = 1): string => {
  const sentences = splitSentences(value);
  if (sentences.length === 0) return normalizeWhitespace(value).slice(0, maxChars).trim();

  let output = "";

  for (const sentence of sentences) {
    const candidate = output ? `${output} ${sentence}` : sentence;
    if (candidate.length > maxChars && output && splitSentences(output).length >= minimumSentences) {
      break;
    }

    output = candidate;
  }

  return output.trim();
};

export const buildArticleExcerpt = (value: string, maxChars = 280): string => clampBySentences(value, maxChars, 1);

export const buildArticlePreviewParagraphs = (
  value: string,
  maxChars = 1000,
  maxParagraphs = 4,
): string[] => {
  const excerpt = clampBySentences(value, maxChars, 3);
  const sentences = splitSentences(excerpt);
  const paragraphs: string[] = [];

  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
    if (paragraphs.length >= maxParagraphs) {
      break;
    }
  }

  return paragraphs.filter(Boolean);
};

export interface NewsItem {
  id: number;
  title: string;
  body: string;
  excerpt: string;
  topics: string[];
  primaryTopic: string;
  primaryTopicLabel: string;
  writer: string;
  url: string;
  source: string;
  publishedAt: string;
  createdAt: string;
}

export interface NewsSnapshot {
  items: NewsItem[];
  generatedAt: string;
}

export interface NewsFeedPage {
  items: NewsItem[];
  total: number;
}

const mapArticleRecord = (article: ArticleRecord): NewsItem => {
  const body = normalizeWhitespace(article.body || "");
  const topics = inferTopics({
    title: article.title,
    body,
    source: article.sourceDomain,
  });
  const primaryTopic = topics[0] || "business";

  return {
    id: article.id,
    title: article.title,
    body,
    excerpt: buildArticleExcerpt(body),
    topics,
    primaryTopic,
    primaryTopicLabel: getTopicLabel(primaryTopic),
    writer: article.writer || "",
    url: article.canonicalUrl,
    source: article.sourceDomain,
    publishedAt: article.publishedAt || "",
    createdAt: article.createdAt,
  };
};

export const loadNewsSnapshot = async (): Promise<NewsSnapshot> => {
  try {
    const [raw, stats] = await Promise.all([
      fs.readFile(appConfig.jsonExportPath, "utf-8"),
      fs.stat(appConfig.jsonExportPath),
    ]);
    const parsed = JSON.parse(raw) as Omit<NewsItem, "excerpt">[];
    const items: NewsItem[] = parsed.map((item) => {
      const body = normalizeWhitespace(item.body || "");
      return {
        ...item,
        body,
        excerpt: buildArticleExcerpt(body),
      };
    });
    return {
      items,
      generatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return {
      items: [],
      generatedAt: new Date().toISOString(),
    };
  }
};

export const loadNewsItems = async (): Promise<NewsItem[]> => {
  const { items } = await queryArticles({
    offset: 0,
    limit: appConfig.maxArticlesInExport,
    sort: "newest",
  });
  return items.map(mapArticleRecord);
};

export const listSources = (items: NewsItem[]): string[] => {
  return [...new Set(items.map((item) => item.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
};

export const findNewsItemById = async (id: number): Promise<NewsItem | null> => {
  const item = await getArticleById(id);
  return item ? mapArticleRecord(item) : null;
};

export const loadFeedPage = async (params?: {
  offset?: number;
  limit?: number;
  source?: string;
  query?: string;
  sort?: "newest" | "oldest" | "title";
  topic?: string;
}): Promise<NewsFeedPage> => {
  const requestedTopic = params?.topic?.trim();
  const offset = Math.max(0, params?.offset || 0);
  const limit = Math.max(1, params?.limit || 24);
  const response = await queryArticles({
    offset: 0,
    limit:
      requestedTopic && requestedTopic !== "all"
        ? appConfig.articleRecordLimit
        : Math.max(offset + limit, limit),
    source: params?.source,
    query: params?.query,
    sort: params?.sort,
  });

  let mapped = response.items.map(mapArticleRecord);

  if (requestedTopic && requestedTopic !== "all") {
    mapped = mapped.filter((item) => item.topics.includes(requestedTopic));
  }

  return {
    items: mapped.slice(offset, offset + limit),
    total: requestedTopic && requestedTopic !== "all" ? mapped.length : response.total,
  };
};

export const getNewsFeedMeta = async (): Promise<{
  totalArticles: number;
  sources: string[];
  topics: Array<{ id: string; label: string }>;
}> => {
  const [totalArticles, sources] = await Promise.all([getArticleCount(), getDistinctSources()]);
  return {
    totalArticles,
    sources,
    topics: topicDefinitions.map((topic) => ({ id: topic.id, label: topic.label })),
  };
};
