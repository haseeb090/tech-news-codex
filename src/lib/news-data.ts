import fs from "node:fs/promises";

import { appConfig } from "@/lib/config";

export interface NewsItem {
  id: number;
  title: string;
  body: string;
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

export const loadNewsSnapshot = async (): Promise<NewsSnapshot> => {
  try {
    const [raw, stats] = await Promise.all([
      fs.readFile(appConfig.jsonExportPath, "utf-8"),
      fs.stat(appConfig.jsonExportPath),
    ]);
    const parsed = JSON.parse(raw) as NewsItem[];
    return {
      items: parsed,
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
  const snapshot = await loadNewsSnapshot();
  return snapshot.items;
};

export const listSources = (items: NewsItem[]): string[] => {
  return [...new Set(items.map((item) => item.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
};

export const findNewsItemById = async (id: number): Promise<NewsItem | null> => {
  const items = await loadNewsItems();
  return items.find((item) => item.id === id) || null;
};
