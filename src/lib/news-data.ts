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

export const loadNewsItems = async (): Promise<NewsItem[]> => {
  try {
    const raw = await fs.readFile(appConfig.jsonExportPath, "utf-8");
    const parsed = JSON.parse(raw) as NewsItem[];
    return parsed;
  } catch {
    return [];
  }
};

export const listSources = (items: NewsItem[]): string[] => {
  return [...new Set(items.map((item) => item.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
};