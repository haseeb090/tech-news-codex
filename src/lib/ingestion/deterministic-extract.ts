import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

import type { ExtractedArticle } from "@/lib/types";

const cleanText = (value: string | null | undefined): string => {
  if (!value) return "";
  const stripped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return stripped.replace(/\s+/g, " ").trim();
};

const readMeta = (root: cheerio.CheerioAPI, names: string[]): string | null => {
  for (const name of names) {
    const byName = root(`meta[name='${name}']`).attr("content");
    if (byName) return cleanText(byName);

    const byProperty = root(`meta[property='${name}']`).attr("content");
    if (byProperty) return cleanText(byProperty);
  }
  return null;
};

const selectBodyCandidate = (root: cheerio.CheerioAPI): string => {
  const candidates = [
    "article",
    "main",
    "[role='main']",
    ".article-body",
    ".entry-content",
    ".post-content",
    ".story-body",
  ];

  let best = "";

  for (const selector of candidates) {
    const text = cleanText(root(selector).first().text());
    if (text.length > best.length) {
      best = text;
    }
  }

  return best;
};

export const fetchHtml = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("Unsupported content type");
  }

  return response.text();
};

export const deterministicExtract = (html: string): ExtractedArticle => {
  const root = cheerio.load(html);
  root("script, style, noscript").remove();

  const title =
    readMeta(root, ["og:title", "twitter:title"]) ||
    cleanText(root("title").first().text()) ||
    cleanText(root("h1").first().text());

  const bodyCandidate = selectBodyCandidate(root);
  const fallbackBody = cleanText(root("body").text());
  const body = bodyCandidate.length >= 200 ? bodyCandidate : fallbackBody;

  const writer =
    readMeta(root, ["author", "article:author", "parsely-author"]) ||
    cleanText(root("[rel='author']").first().text()) ||
    null;

  const publishedAt = readMeta(root, ["article:published_time", "publish-date", "date", "parsely-pub-date"]) || null;

  return {
    title,
    body,
    writer,
    publishedAt,
  };
};

export const sourceTextForValidation = (html: string): string => {
  const root = cheerio.load(html);
  root("script, style, noscript").remove();
  return cleanText(root("body").text());
};