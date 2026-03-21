import { tokenize } from "@/lib/url-utils";
import type { ExtractedArticle, PreparedArticle } from "@/lib/types";

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const extractNumericTokens = (value: string): string[] => {
  const matches = value.toLowerCase().match(/\b\d+(?:\.\d+)?\b/g) || [];
  return [...new Set(matches)];
};
const extractBroadRelativeTimePhrases = (value: string): string[] => {
  const matches = value
    .toLowerCase()
    .match(/\b(?:over\s+the\s+|in\s+the\s+)?past\s+(?:day|week|month|quarter|year|decade)s?\b/g);
  return [...new Set(matches || [])];
};
const unsupportedUncertaintyPattern = /\b(undisclosed|unnamed|unidentified|identity remains unknown|identity remains undisclosed)\b/i;

const hasTokenOverlap = (candidate: string, source: string, minRatio: number): boolean => {
  const candidateTokens = tokenize(candidate);
  if (candidateTokens.length === 0) return false;

  const sourceTokenSet = new Set(tokenize(source));
  let hits = 0;
  for (const token of candidateTokens) {
    if (sourceTokenSet.has(token)) {
      hits += 1;
    }
  }

  return hits / candidateTokens.length >= minRatio;
};

const wordWindows = (value: string, size: number): Set<string> => {
  const words = normalize(value)
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length < size) {
    return new Set(words.length === 0 ? [] : [words.join(" ")]);
  }

  const windows = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) {
    windows.add(words.slice(index, index + size).join(" "));
  }

  return windows;
};

export const longestSharedWordRun = (left: string, right: string, maxWindow = 12): number => {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) return 0;

  const leftWordCount = normalizedLeft.split(" ").filter(Boolean).length;
  const rightWordCount = normalizedRight.split(" ").filter(Boolean).length;
  const upperBound = Math.min(maxWindow, leftWordCount, rightWordCount);

  for (let size = upperBound; size >= 3; size -= 1) {
    const leftWindows = wordWindows(normalizedLeft, size);
    const rightWindows = wordWindows(normalizedRight, size);

    for (const candidate of leftWindows) {
      if (rightWindows.has(candidate)) {
        return size;
      }
    }
  }

  return 0;
};

export const validateRewrittenArticle = (
  article: PreparedArticle,
  params: { extracted: ExtractedArticle; sourceText: string },
): { ok: boolean; reason?: string } => {
  if (!article.title || article.title.trim().length < 16) {
    return { ok: false, reason: "Rewritten title too short" };
  }

  if (!article.body || article.body.trim().length < 320) {
    return { ok: false, reason: "Rewritten body too short" };
  }

  const bodySentences = article.body.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (bodySentences.length < 4) {
    return { ok: false, reason: "Rewritten body is not article-like enough" };
  }

  if (/["“”]/.test(article.body)) {
    return { ok: false, reason: "Rewritten body still contains quoted source wording" };
  }

  const titleRun = Math.max(
    longestSharedWordRun(article.title, params.extracted.title, 8),
    longestSharedWordRun(article.title, params.sourceText, 8),
  );
  if (titleRun >= 4) {
    return { ok: false, reason: "Rewritten title is too close to the source wording" };
  }

  const bodyRun = Math.max(
    longestSharedWordRun(article.body, params.extracted.body, 12),
    longestSharedWordRun(article.body, params.sourceText, 12),
  );
  if (bodyRun >= 8) {
    return { ok: false, reason: "Rewritten body still reuses long source phrases" };
  }

  const titleSupportSource = [params.extracted.title, params.extracted.context || "", params.sourceText].filter(Boolean).join(" ");
  const titleSupported =
    normalize(titleSupportSource).includes(normalize(article.title)) || hasTokenOverlap(article.title, titleSupportSource, 0.35);
  if (!titleSupported) {
    return { ok: false, reason: "Rewritten title is not grounded in extracted facts" };
  }

  const firstBodySlice = article.body.split(/\s+/).slice(0, 80).join(" ");
  const groundingSource = `${params.extracted.body} ${params.sourceText}`;
  if (!hasTokenOverlap(firstBodySlice, groundingSource, 0.35)) {
    return { ok: false, reason: "Rewritten body drifted too far from extracted facts" };
  }

  const sourceNumbers = new Set(extractNumericTokens(`${params.extracted.title} ${params.extracted.body} ${params.sourceText}`));
  const unsupportedNumbers = extractNumericTokens(`${article.title} ${article.body}`).filter((token) => !sourceNumbers.has(token));
  if (unsupportedNumbers.length > 0) {
    return { ok: false, reason: "Rewritten article introduced unsupported numeric details" };
  }

  const sourceBroadRelativeTimes = new Set(
    extractBroadRelativeTimePhrases(`${params.extracted.title} ${params.extracted.body} ${params.sourceText}`),
  );
  const unsupportedBroadRelativeTimes = extractBroadRelativeTimePhrases(`${article.title} ${article.body}`).filter(
    (phrase) => !sourceBroadRelativeTimes.has(phrase),
  );
  if (unsupportedBroadRelativeTimes.length > 0) {
    return { ok: false, reason: "Rewritten article introduced unsupported time-window claims" };
  }

  if (
    unsupportedUncertaintyPattern.test(article.body) &&
    !unsupportedUncertaintyPattern.test(`${params.extracted.title} ${params.extracted.body} ${params.sourceText}`)
  ) {
    return { ok: false, reason: "Rewritten article introduced unsupported uncertainty claims" };
  }

  return { ok: true };
};
