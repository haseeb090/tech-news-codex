import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
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
  /advertiser disclosure/i,
  /sponsored/i,
  /recommended videos/i,
  /most popular/i,
  /more from/i,
  /follow us on/i,
  /listen to this article/i,
  /watch:/i,
  /read more:/i,
  /supported by/i,
  /affiliate/i,
  /if you buy something/i,
  /may earn commission/i,
  /partner content/i,
  /author bio/i,
  /about the author/i,
  /cookie policy/i,
  /register now/i,
  /save up to/i,
  /prices were accurate at the time of publishing/i,
];

const NOISE_LINE_PATTERNS = [
  /^advertisement$/i,
  /^sponsored/i,
  /^related (stories|articles)/i,
  /^read more/i,
  /^recommended/i,
  /^most popular/i,
  /^watch/i,
  /^listen/i,
  /^newsletter/i,
  /^sign up/i,
  /^follow us/i,
  /^if you buy something/i,
  /^register now/i,
  /^prices were accurate at the time of publishing/i,
  /^more from/i,
  /^about the author/i,
  /^author bio/i,
  /^image credits?/i,
  /^photo:/i,
  /^source:/i,
  /^share this/i,
  /^copyright/i,
];

const CONTEXT_META_NAMES = ["description", "og:description", "twitter:description"];
const CONTEXT_SELECTORS = [
  ".article-subtitle",
  ".entry-subtitle",
  ".post-subtitle",
  ".dek",
  ".standfirst",
  ".subhead",
  ".summary",
  "header p",
  "article h2",
];

const VERGE_COMMERCE_PATTERNS = [
  /vox media may earn/i,
  /if you buy something from a verge link/i,
  /prices were accurate at the time of publishing/i,
  /subject to change/i,
  /deals newsletter/i,
  /installer newsletter/i,
  /weekender/i,
];

const repairLatin1Utf8Mojibake = (value: string): string => {
  if (!/[ÃÂâ]/.test(value)) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    const originalNoise = (value.match(/[ÃÂâ]/g) || []).length;
    const repairedNoise = (repaired.match(/[ÃÂâ]/g) || []).length;
    if (/[�\u0000-\u001f]/.test(repaired)) {
      return value;
    }

    return repairedNoise < originalNoise ? repaired : value;
  } catch {
    return value;
  }
};

const repairMojibake = (value: string): string => {
  const repaired = repairLatin1Utf8Mojibake(value);

  return repaired
    .replace(/Ã¢â‚¬â€/g, " - ")
    .replace(/Ã¢â‚¬â€œ/g, " - ")
    .replace(/Ã¢â‚¬Â¦/g, "...")
    .replace(/Ã¢â‚¬Â¢/g, " - ")
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Ëœ/g, "'")
    .replace(/Ã¢â‚¬Å“/g, '"')
    .replace(/Ã¢â‚¬ï¿½/g, '"')
    .replace(/Ã¢â‚¬/g, '"')
    .replace(/â€”/g, " - ")
    .replace(/â€“/g, " - ")
    .replace(/â€¦/g, "...")
    .replace(/â€¢/g, " - ")
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€�/g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã‚Â·/g, " - ")
    .replace(/Ã‚ /g, " ")
    .replace(/Ã‚/g, "")
    .replace(/Â·/g, " - ")
    .replace(/Â /g, " ")
    .replace(/Â/g, "")
    .replace(/\u009d/g, "");
};

const cleanText = (value: string | null | undefined): string => {
  if (!value) return "";
  const stripped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
  return repairMojibake(stripped).replace(/\s+/g, " ").trim();
};

const stripTitleSuffix = (value: string): string => {
  return value
    .replace(/\s+[|\-–—:]\s+(techcrunch|engadget|the verge|wired|bleepingcomputer|mit technology review|zdnet|slashdot)$/i, "")
    .trim();
};

const isNoiseLine = (value: string): boolean => {
  const compact = cleanText(value);
  if (!compact) return true;
  if (compact.length < 24) return true;
  if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(compact))) return true;
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(compact))) return true;
  if (/^(click here|continue reading|join the conversation)/i.test(compact)) return true;
  if (compact.split(" ").length <= 4 && !/[.!?]$/.test(compact)) return true;
  return false;
};

const stripBoilerplateLines = (value: string): string => {
  const compact = cleanText(value);
  if (!compact) return "";

  const segments = compact
    .split(/(?:\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9"]))|(?:\s{2,})/)
    .map((segment) => cleanText(segment))
    .filter(Boolean);

  return segments.filter((segment) => !isNoiseLine(segment)).join(" ").trim();
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

const extractCleanedTitle = (root: cheerio.CheerioAPI, readabilityTitle?: string | null): string => {
  const title =
    readMeta(root, ["og:title", "twitter:title", "headline"]) ||
    readabilityTitle ||
    cleanText(root("title").first().text()) ||
    cleanText(root("h1").first().text());

  return stripBoilerplateLines(stripTitleSuffix(title));
};

const dedupeParagraphs = (paragraphs: string[]): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const paragraph of paragraphs) {
    const normalized = paragraph.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(paragraph);
  }

  return deduped;
};

const collectParagraphsFromNode = (root: cheerio.CheerioAPI, selector: string): string[] => {
  const node = root(selector).first();
  if (node.length === 0) return [];

  const paragraphNodes = node.find("p, h2, h3, li").toArray();
  const fromParagraphs = paragraphNodes
    .map((element) => stripBoilerplateLines(root(element).text()))
    .filter((text) => text.length >= 40 && !isNoiseLine(text));

  if (fromParagraphs.length > 0) {
    return dedupeParagraphs(fromParagraphs);
  }

  const fallback = stripBoilerplateLines(node.text());
  if (!fallback) return [];

  return dedupeParagraphs(
    fallback
      .split(/(?<=[.!?])\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 40 && !isNoiseLine(segment)),
  );
};

const combineParagraphs = (paragraphs: string[], minimumLength = 240): string => {
  const combined = dedupeParagraphs(paragraphs).slice(0, 24).join(" ").trim();
  return combined.length >= minimumLength ? combined : "";
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

  let bestParagraphs: string[] = [];
  let bestCombined = "";

  for (const selector of candidates) {
    const paragraphs = collectParagraphsFromNode(root, selector);
    const combined = combineParagraphs(paragraphs, 1);
    if (combined.length > bestCombined.length) {
      bestParagraphs = paragraphs;
      bestCombined = combined;
    }
  }

  return combineParagraphs(bestParagraphs, 240);
};

const extractSourceSpecificBody = (root: cheerio.CheerioAPI, sourceDomain: string): string => {
  if (sourceDomain === "www.engadget.com") {
    const paragraphs = root("article p, main p, p")
      .toArray()
      .map((element) => stripBoilerplateLines(root(element).text()))
      .filter((text) => text.length >= 40 && !isNoiseLine(text));

    return combineParagraphs(paragraphs);
  }

  if (sourceDomain === "www.theverge.com") {
    const paragraphs = root("article p, main p, .duet--article--article-body-component p, p")
      .toArray()
      .map((element) => stripBoilerplateLines(root(element).text()))
      .filter(
        (text) => text.length >= 40 && !isNoiseLine(text) && !VERGE_COMMERCE_PATTERNS.some((pattern) => pattern.test(text)),
      );

    return combineParagraphs(paragraphs);
  }

  return "";
};

const paragraphFallback = (root: cheerio.CheerioAPI): string => {
  const paragraphSelectors = ["article p", "main p", ".caas-body p", ".article-text p", ".entry-body p", "p"];

  for (const selector of paragraphSelectors) {
    const paragraphs = root(selector)
      .toArray()
      .map((element) => stripBoilerplateLines(root(element).text()))
      .filter((text) => text.length >= 40 && !isNoiseLine(text));

    const combined = combineParagraphs(paragraphs);
    if (combined) {
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
    "script, style, noscript, svg, canvas, form, button, nav, footer, aside, iframe, [aria-hidden='true'], [data-nosnippet], .newsletter, .subscribe, .related, .recommended, .comments, .promo, .advertisement, .social, .share, .sidebar, .sticky, .outbrain, .taboola, .author-bio, .most-popular, .trending, .read-next, .newsletter-signup, .ad, .ads, .sponsored, [class*='promo'], [class*='newsletter'], [class*='outbrain'], [class*='taboola'], [class*='recommended'], [class*='related'], [id*='taboola'], [id*='outbrain']",
  ).remove();

  return root.html() || html;
};

const extractTitleContext = (root: cheerio.CheerioAPI, title: string): string | null => {
  const metaContext = readMeta(root, CONTEXT_META_NAMES);
  const cleanedMetaContext = stripBoilerplateLines(metaContext || "");
  if (cleanedMetaContext && cleanedMetaContext.length >= 40 && cleanedMetaContext !== title && !isNoiseLine(cleanedMetaContext)) {
    return cleanedMetaContext;
  }

  for (const selector of CONTEXT_SELECTORS) {
    const candidate = stripBoilerplateLines(root(selector).first().text());
    if (
      candidate &&
      candidate.length >= 40 &&
      candidate.length <= 260 &&
      candidate !== title &&
      !isNoiseLine(candidate)
    ) {
      return candidate;
    }
  }

  return null;
};

const extractWithReadability = (
  html: string,
  url: string | undefined,
): { title: string; body: string; writer: string | null; context: string | null } | null => {
  try {
    const dom = new JSDOM(html, { url: url || "https://example.com" });
    const article = new Readability(dom.window.document).parse();
    if (!article) {
      return null;
    }

    const title = stripBoilerplateLines(stripTitleSuffix(cleanText(article.title)));
    const paragraphs = repairMojibake(article.textContent || "")
      .split(/\n+/)
      .map((paragraph) => stripBoilerplateLines(paragraph))
      .filter((paragraph) => paragraph.length >= 40 && !isNoiseLine(paragraph));
    const body = combineParagraphs(paragraphs, 180);
    const writer = article.byline ? stripBoilerplateLines(cleanText(article.byline)) : null;
    const context = article.excerpt ? stripBoilerplateLines(cleanText(article.excerpt)) : null;

    if (!title || body.length < 180) {
      return null;
    }

    return {
      title,
      body,
      writer,
      context: context && context !== title ? context : null,
    };
  } catch {
    return null;
  }
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

  const html = repairMojibake(await response.text());
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
  const readability = extractWithReadability(normalizedHtml, url);

  const bodyCandidate = selectBodyCandidate(root);
  const sourceSpecificBody = extractSourceSpecificBody(root, sourceDomain);
  const paragraphBody = bodyCandidate.length >= 240 ? "" : paragraphFallback(root);
  const fallbackBody = stripBoilerplateLines(root("body").text());
  const body =
    readability?.body && readability.body.length >= 240
      ? readability.body
      : bodyCandidate.length >= 240
        ? bodyCandidate
        : sourceSpecificBody.length >= 240
          ? sourceSpecificBody
          : paragraphBody.length >= 240
            ? paragraphBody
            : fallbackBody;

  const writer =
    readability?.writer ||
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

  const cleanedTitle = extractCleanedTitle(root, readability?.title);

  return {
    title: cleanedTitle,
    body: stripBoilerplateLines(body),
    writer: writer ? cleanText(writer) : null,
    publishedAt,
    context: extractTitleContext(root, cleanedTitle) || readability?.context || null,
  };
};

export const sourceTextForValidation = (html: string, url?: string): string => {
  const normalizedHtml = normalizeHtmlForExtraction(html);
  const readability = extractWithReadability(normalizedHtml, url);
  const root = cheerio.load(normalizedHtml);
  const cleanedTitle = extractCleanedTitle(root, readability?.title);
  const validationHeader = [cleanedTitle, extractTitleContext(root, cleanedTitle) || readability?.context || null]
    .filter((value): value is string => Boolean(value))
    .join("\n");
  const combineValidationSource = (body: string): string => [validationHeader, body].filter(Boolean).join("\n\n");

  if (readability?.body && readability.body.length >= 240) {
    return combineValidationSource(readability.body);
  }
  const sourceDomain = url ? getSourceDomain(url) : "";
  const bodyCandidate = selectBodyCandidate(root);
  if (bodyCandidate.length >= 240) {
    return combineValidationSource(bodyCandidate);
  }

  const sourceSpecificBody = extractSourceSpecificBody(root, sourceDomain);
  if (sourceSpecificBody.length >= 240) {
    return combineValidationSource(sourceSpecificBody);
  }

  const paragraphBody = paragraphFallback(root);
  if (paragraphBody.length >= 240) {
    return combineValidationSource(paragraphBody);
  }

  return combineValidationSource(stripBoilerplateLines(root("body").text()));
};
