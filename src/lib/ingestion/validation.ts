import { tokenize } from "@/lib/url-utils";
import type { ExtractedArticle } from "@/lib/types";

const BOILERPLATE_PATTERNS = [
  /privacy policy/i,
  /all rights reserved/i,
  /sign up/i,
  /newsletter/i,
  /community guidelines/i,
  /cookie policy/i,
  /show comments/i,
  /follow us/i,
];

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, " ").trim();

const hasTokenOverlap = (candidate: string, source: string, minRatio: number): boolean => {
  const candidateTokens = tokenize(candidate);
  if (candidateTokens.length === 0) return false;

  const sourceTokenSet = new Set(tokenize(source));
  let hits = 0;
  for (const token of candidateTokens) {
    if (sourceTokenSet.has(token)) hits += 1;
  }

  return hits / candidateTokens.length >= minRatio;
};

export const validateExtractionAgainstSource = (
  extracted: ExtractedArticle,
  sourceText: string,
): { ok: boolean; reason?: string } => {
  const normalizedSource = normalize(sourceText);

  if (!extracted.title || extracted.title.length < 12) {
    return { ok: false, reason: "Title too short" };
  }

  if (!extracted.body || extracted.body.length < 280) {
    return { ok: false, reason: "Body too short" };
  }

  const boilerplateHits = BOILERPLATE_PATTERNS.filter((pattern) => pattern.test(extracted.body)).length;
  if (boilerplateHits >= 2) {
    return { ok: false, reason: "Body still contains site boilerplate" };
  }

  const sentences = extracted.body.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 4) {
    return { ok: false, reason: "Body is not article-like enough" };
  }

  const normalizedTitle = normalize(extracted.title);
  const titleSupported = normalizedSource.includes(normalizedTitle) || hasTokenOverlap(extracted.title, sourceText, 0.5);
  if (!titleSupported) {
    return { ok: false, reason: "Title not supported by source text" };
  }

  const firstBodySlice = extracted.body.split(/\s+/).slice(0, 60).join(" ");
  const bodySupported = hasTokenOverlap(firstBodySlice, sourceText, 0.75);
  if (!bodySupported) {
    return { ok: false, reason: "Body content not grounded in source text" };
  }

  if (extracted.writer && extracted.writer.length > 0) {
    const writerSupported = normalizedSource.includes(normalize(extracted.writer)) || hasTokenOverlap(extracted.writer, sourceText, 0.5);
    if (!writerSupported) {
      return { ok: false, reason: "Writer name not supported by source text" };
    }
  }

  return { ok: true };
};
