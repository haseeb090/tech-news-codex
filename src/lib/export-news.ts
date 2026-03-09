import fs from "node:fs/promises";
import path from "node:path";

import { stringify } from "csv-stringify/sync";

import { appConfig } from "@/lib/config";
import { getLatestArticles } from "@/lib/db";

export const exportNewsArtifacts = async (): Promise<void> => {
  const articles = getLatestArticles(appConfig.maxArticlesInExport);

  await fs.mkdir(path.dirname(appConfig.csvExportPath), { recursive: true });
  await fs.mkdir(path.dirname(appConfig.jsonExportPath), { recursive: true });

  const csvRows = articles.map((article) => ({
    id: article.id,
    title: article.title,
    body: article.body,
    writer: article.writer || "",
    url: article.canonicalUrl,
    source: article.sourceDomain,
    publishedAt: article.publishedAt || "",
    createdAt: article.createdAt,
  }));

  const csv = stringify(csvRows, {
    header: true,
    columns: [
      "id",
      "title",
      "body",
      "writer",
      "url",
      "source",
      "publishedAt",
      "createdAt",
    ],
  });

  await fs.writeFile(appConfig.csvExportPath, csv, "utf-8");
  await fs.writeFile(appConfig.jsonExportPath, JSON.stringify(csvRows, null, 2), "utf-8");
};

export const loadExportedNews = async (): Promise<Array<Record<string, string | number>>> => {
  try {
    const raw = await fs.readFile(appConfig.jsonExportPath, "utf-8");
    return JSON.parse(raw) as Array<Record<string, string | number>>;
  } catch {
    return [];
  }
};