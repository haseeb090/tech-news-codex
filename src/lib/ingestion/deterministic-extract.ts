import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

import { appConfig } from "@/lib/config";
import type { ExtractedArticle } from "@/lib/types";
import { getSourceDomain } from "@/lib/url-utils";

const BOILERPLATE_PATTERNS = [
  /privacy policy/i,
  /terms of service/i,
  /all rights reserved/i,
  /community guidelines/i,
  /sign up for/i,
  /newsletter/i,
  /follow us/i,
  /show comments/i,
  /related (stories|articles)/i,
  /editorial standards/i,
  /advertisement/i,
  /cookie policy/i,
];

const cleanText = (value: string | null | undefined): string => {
  if (!value) return "";
  const stripped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return stripped.replace(/\s+/g, " ").trim();
};

const stripTitleSuffix = (value: string): string => {
  return value
    .replace(/\s+[|\-–—]\s+(techcrunch|engadget|the verge|wired|bleepingcomputer|mit technology review|zdnet|slashdot)$/i, "")
    .trim();
};

const stripBoilerplateLines = (value: string): string => {
  const compact = cleanText(value);
  if (!compact) return "";

  const sentences = compact
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const filtered = sentences.filter((sentence) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(sentence)));
  return filtered.join(" ").trim();
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
    "[itemprop='articleBody']",
    "main",
    "[role='main']",
    ".article-body",
    ".entry-content",
    ".post-content",
    ".story-body",
    ".article-content",
    ".caas-body",
    ".article-text",
    ".content-block",
    ".entry-body",
  ];

  let best = "";

  for (const selector of candidates) {
    const text = stripBoilerplateLines(root(selector).first().text());
    if (text.length > best.length) {
      best = text;
    }
  }

  return best;
};

const extractSourceSpecificBody = (root: cheerio.CheerioAPI, sourceDomain: string): string => {
  if (sourceDomain === "www.engadget.com") {
    const paragraphs = root("article p, main p, p")
      .toArray()
      .map((element) => stripBoilerplateLines(root(element).text()))
      .filter((text) => text.length >= 30);

    const combined = paragraphs.slice(0, 24).join(" ");
    if (combined.length >= 240) {
      return combined;
    }
  }

  return "";
};

const paragraphFallback = (root: cheerio.CheerioAPI): string => {
  const paragraphSelectors = ["article p", "main p", ".caas-body p", ".article-text p", ".entry-body p", "p"];

  for (const selector of paragraphSelectors) {
    const paragraphs = root(selector)
      .toArray()
      .map((element) => stripBoilerplateLines(root(element).text()))
      .filter((text) => text.length >= 30);

    const combined = paragraphs.slice(0, 24).join(" ");
    if (combined.length >= 240) {
      return combined;
    }
  }

  return "";
};

const detectBlockedChallengePage = (sourceDomain: string, html: string): string | null => {
  const compact = html.replace(/\s+/g, " ").toLowerCase();

  if (
    sourceDomain === "www.bleepingcomputer.com" &&
    compact.includes("just a moment") &&
    (compact.includes("cloudflare") || compact.includes("cf-chl") || compact.includes("challenge-platform"))
  ) {
    return "Blocked by anti-bot challenge";
  }

  return null;
};

export const normalizeHtmlForExtraction = (html: string): string => {
  const root = cheerio.load(html);
  root(
    "script, style, noscript, svg, canvas, form, button, nav, footer, aside, iframe, [aria-hidden='true'], [data-nosnippet], .newsletter, .subscribe, .related, .recommended, .comments, .promo, .advertisement, .social, .share, .sidebar, .sticky, .outbrain, .taboola",
  ).remove();

  return root.html() || html;
};

export const fetchHtml = async (
  url: string,
  timeoutMs = appConfig.articleFetchTimeoutMs,
): Promise<string> => {
  const sourceDomain = getSourceDomain(url);
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("Unsupported content type");
  }

  const html = await response.text();
  const blockedReason = detectBlockedChallengePage(sourceDomain, html);
  if (blockedReason) {
    throw new Error(blockedReason);
  }

  return html;
};

export const deterministicExtract = (html: string, url?: string): ExtractedArticle => {
  const normalizedHtml = normalizeHtmlForExtraction(html);
  const root = cheerio.load(normalizedHtml);
  const sourceDomain = url ? getSourceDomain(url) : "";

  const title =
    readMeta(root, ["og:title", "twitter:title", "headline"]) ||
    cleanText(root("title").first().text()) ||
    cleanText(root("h1").first().text());

  const bodyCandidate = selectBodyCandidate(root);
  const sourceSpecificBody = extractSourceSpecificBody(root, sourceDomain);
  const paragraphBody = bodyCandidate.length >= 240 ? "" : paragraphFallback(root);
  const fallbackBody = stripBoilerplateLines(root("body").text());
  const body =
    bodyCandidate.length >= 240
      ? bodyCandidate
      : sourceSpecificBody.length >= 240
        ? sourceSpecificBody
      : paragraphBody.length >= 240
        ? paragraphBody
        : fallbackBody;

  const writer =
    readMeta(root, ["author", "article:author", "parsely-author"]) ||
    cleanText(root("[itemprop='author']").first().text()) ||
    cleanText(root("[rel='author']").first().text()) ||
    null;

  const publishedAt =
    readMeta(root, [
      "article:published_time",
      "publish-date",
      "date",
      "parsely-pub-date",
      "pubdate",
      "timestamp",
    ]) || null;

  return {
    title: stripBoilerplateLines(stripTitleSuffix(title)),
    body: stripBoilerplateLines(body),
    writer: writer ? stripBoilerplateLines(writer) : null,
    publishedAt,
  };
};

export const sourceTextForValidation = (html: string, url?: string): string => {
  const normalizedHtml = normalizeHtmlForExtraction(html);
  const root = cheerio.load(normalizedHtml);
  const sourceDomain = url ? getSourceDomain(url) : "";
  const bodyCandidate = selectBodyCandidate(root);
  if (bodyCandidate.length >= 240) {
    return bodyCandidate;
  }

  const sourceSpecificBody = extractSourceSpecificBody(root, sourceDomain);
  if (sourceSpecificBody.length >= 240) {
    return sourceSpecificBody;
  }

  const paragraphBody = paragraphFallback(root);
  if (paragraphBody.length >= 240) {
    return paragraphBody;
  }

  return stripBoilerplateLines(root("body").text());
};
