import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

import { appConfig } from "@/lib/config";
import { validateRewrittenArticle } from "@/lib/ingestion/rewrite-validation";
import type { ExtractedArticle, PreparedArticle } from "@/lib/types";

const rewriteSchema = z.object({
  title: z.string().min(16),
  body: z.string().min(320),
  writer: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

const titleRewriteSchema = z.object({
  title: z.string().min(16),
});

const factDistillationSchema = z.object({
  angle: z.string().min(12),
  keyFacts: z.array(z.string().min(8)).min(4).max(10),
  supportingContext: z.array(z.string().min(4)).max(6),
  namedEntities: z.array(z.string().min(2)).max(12),
  importantNumbers: z.array(z.string().min(1)).max(8),
  timeline: z.array(z.string().min(4)).max(8),
  writer: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

type DistilledFacts = z.infer<typeof factDistillationSchema>;

const rewriteModel = new ChatOllama({
  baseUrl: appConfig.ollamaBaseUrl,
  model: appConfig.ollamaModel,
  temperature: 0.2,
});

const normalizeWhitespace = (value: string | null | undefined): string => value?.replace(/\s+/g, " ").trim() || "";
const invalidDateValues = new Set(["unknown", "n/a", "na", "none", "null", "-"]);
const invalidWriterValues = new Set(["unknown", "n/a", "na", "none", "null", "-", "staff", "staff writer"]);
const commerceLanguagePattern =
  /\b(deal|discount|sale|save|coupon|lowest price|best buy|amazon|walmart|target|buy now|shopping)\b/i;

const splitIntoSentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 24);

const normalizeList = (values: Array<string | null | undefined>, maxItems: number): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const item = normalizeWhitespace(value);
    if (!item) continue;

    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);

    if (normalized.length >= maxItems) {
      break;
    }
  }

  return normalized;
};

const normalizeOptionalDate = (value: string | null | undefined): string | null => {
  const normalized = normalizeWhitespace(value);
  if (!normalized || invalidDateValues.has(normalized.toLowerCase())) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeOptionalWriter = (value: string | null | undefined): string | null => {
  const normalized = normalizeWhitespace(value);
  if (!normalized || invalidWriterValues.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
};

const buildFactSeedNotes = (extracted: ExtractedArticle): string[] =>
  normalizeList([extracted.context, extracted.title, ...splitIntoSentences(extracted.body).slice(0, 6)], 8);

const detectCommerceArticle = (extracted: ExtractedArticle, sourceDomain?: string): boolean => {
  const subject = [extracted.title, extracted.context || "", ...splitIntoSentences(extracted.body).slice(0, 2)].join(" ");
  return sourceDomain === "www.theverge.com" && commerceLanguagePattern.test(subject);
};

const buildForbiddenHeadlinePhrases = (extracted: ExtractedArticle): string[] => {
  const source = [extracted.title, extracted.context || ""].filter(Boolean).join(" ");
  const tokens = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const phrases: string[] = [];
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const phrase = tokens.slice(index, index + 4).join(" ");
    if (!phrases.includes(phrase)) {
      phrases.push(phrase);
    }
    if (phrases.length >= 6) {
      break;
    }
  }

  return phrases;
};

const createDeadline = (processingTimeoutMs?: number): number => {
  const base = processingTimeoutMs ?? appConfig.articleProcessTimeoutMs;
  return Date.now() + Math.min(Math.max(base * 2, 90_000), 150_000);
};

const getRemainingBudgetMs = (deadline: number): number => deadline - Date.now();

const getInvokeTimeoutMs = (deadline: number, preferred: number): number => {
  const remaining = getRemainingBudgetMs(deadline);
  if (remaining <= 6_000) {
    throw new Error("Rewrite validation failed: Rewrite budget exhausted");
  }

  return Math.max(5_000, Math.min(preferred, remaining - 1_500));
};

const normalizeDistilledFacts = (result: DistilledFacts, extracted: ExtractedArticle): DistilledFacts => {
  const factSeedNotes = buildFactSeedNotes(extracted);

  return {
    angle: normalizeWhitespace(result.angle) || extracted.context || extracted.title,
    keyFacts: normalizeList([...(result.keyFacts || []), ...factSeedNotes], 10),
    supportingContext: normalizeList([...(result.supportingContext || []), extracted.context, extracted.title], 6),
    namedEntities: normalizeList(result.namedEntities || [], 12),
    importantNumbers: normalizeList(result.importantNumbers || [], 8),
    timeline: normalizeList(result.timeline || [], 8),
    writer: normalizeOptionalWriter(result.writer) || normalizeOptionalWriter(extracted.writer),
    publishedAt: normalizeOptionalDate(result.publishedAt) || normalizeOptionalDate(extracted.publishedAt),
  };
};

const buildFactDistillationPrompt = (extracted: ExtractedArticle) => `You convert extracted news copy into structured fact notes for a downstream writer.
Your job is to preserve the facts while breaking away from the publisher's original phrasing.

Rules:
- Capture the main development, the most important supporting facts, and why the story matters.
- Use neutral note-like fragments, not polished article prose.
- Do not copy source sentences or preserve sentence structure.
- Keep at least one material caveat, controversy, or limiting detail when the source includes one.
- For policy, legal, or regulatory stories, record only the provisions, exceptions, or timelines explicitly named in the source.
- Do not turn relative time references into explicit years or dates unless the source states them.
- Preserve stated time windows accurately; do not broaden phrases like "last month" into "past year" or similar.
- Exclude ads, affiliate copy, newsletters, author bios, "most popular", promos, or calls to action.
- Keep names, companies, product names, dates, and numbers accurate.
- If writer or published date is unclear, return null.

Extracted headline:
${extracted.title}

Optional context line:
${extracted.context || "None"}

Extracted article body:
${extracted.body}

Writer:
${extracted.writer || "Unknown"}

Published at:
${extracted.publishedAt || "Unknown"}`;

const formatDistilledFacts = (facts: DistilledFacts): string => {
  const lines = [`Working angle: ${facts.angle}`, "Key facts:"];

  lines.push(...facts.keyFacts.map((fact, index) => `${index + 1}. ${fact}`));

  if (facts.supportingContext.length > 0) {
    lines.push(`Context: ${facts.supportingContext.join(" | ")}`);
  }

  if (facts.namedEntities.length > 0) {
    lines.push(`Named entities: ${facts.namedEntities.join(", ")}`);
  }

  if (facts.importantNumbers.length > 0) {
    lines.push(`Important numbers: ${facts.importantNumbers.join(" | ")}`);
  }

  if (facts.timeline.length > 0) {
    lines.push(`Timeline: ${facts.timeline.join(" | ")}`);
  }

  return lines.join("\n");
};

const buildRewritePrompt = (params: {
  extracted: ExtractedArticle;
  attempt: number;
  previousFailureReason?: string;
  distilledFacts?: DistilledFacts | null;
  sourceDomain?: string;
}) => {
  const isFactsMode = Boolean(params.distilledFacts);
  const isCommerceArticle = detectCommerceArticle(params.extracted, params.sourceDomain);
  const stricterInstruction =
    params.attempt > 1 && params.previousFailureReason
      ? `Previous rewrite failed this check: ${params.previousFailureReason}.
- Increase paraphrasing strength.
- Recast the lede and sentence structure from a different angle.
- Do not reuse any 4-word phrase from the source headline.
- Do not reuse any 8-word phrase from the source body.`
      : "";

  return `You rewrite extracted news content for public display.
Your job is to preserve facts while removing the publisher's original wording.

Rules:
- Keep every fact grounded in the extracted article details below.
- Write a fresh, contextual headline in your own words.
- Write a concise news summary in your own words, usually 5 to 8 sentences, with no quotes.
- Do not copy source sentences or long phrases.
- Do not introduce products, providers, services, apps, companies, or people that are not explicitly named below.
- If the source covers a numbered list, a set of picks, or a comparison, preserve the same scope and do not add extra items.
- For guides or how-to content, only describe the methods explicitly covered by the source.
- For reviews, keep the rewrite scoped to the reviewed product and the source's stated findings.
- Do not say a person, identity, cause, or detail is unknown or undisclosed unless the source explicitly says that.
- Do not introduce alternative hypotheses, causes, or explanations unless the source explicitly includes them.
- Do not convert relative timing into explicit years, dates, or durations unless the source explicitly states them.
- Preserve stated time windows accurately; do not broaden "last month," "this week," or similar ranges into looser periods.
- For policy, legal, or regulatory stories, name only the provisions, exceptions, or enforcement details that the source explicitly includes.
- When the source includes a notable caveat, controversy, or skepticism, preserve at least one of those nuances in the rewrite.
- Use clear newsroom language instead of marketing language.
- Do not mention that this is a summary, rewrite, or paraphrase.
- Exclude ads, affiliate copy, newsletters, author bios, "most popular", promos, or calls to action.
- Keep names, companies, product names, dates, and numbers accurate.
- If writer or published date is unclear, return null.
- Keep the key news angle concrete in the first sentence.
${isFactsMode ? "- Work from the distilled fact notes below instead of mirroring source prose." : ""}
${isCommerceArticle ? "- For commerce coverage, avoid promo phrasing like 'best deal' or 'lowest price'; frame the headline and lede around the product change, availability, or buyer-relevant development instead." : ""}
${stricterInstruction}

${isFactsMode ? `Distilled factual notes:\n${formatDistilledFacts(params.distilledFacts!)}` : `Extracted headline:
${params.extracted.title}

Optional context line:
${params.extracted.context || "None"}

Extracted article body:
${params.extracted.body}`}

Writer:
${params.distilledFacts?.writer || params.extracted.writer || "Unknown"}

Published at:
${params.distilledFacts?.publishedAt || params.extracted.publishedAt || "Unknown"}`;
};

const buildTitleRewritePrompt = (params: {
  extracted: ExtractedArticle;
  article: PreparedArticle;
  attempt: number;
  previousFailureReason?: string;
  distilledFacts?: DistilledFacts | null;
  sourceDomain?: string;
}) => `You write a single public-facing news headline in original wording.
Your goal is to keep the facts intact while avoiding the publisher's phrasing.

Rules:
- Write one headline only.
- Keep it factual, contextual, and grounded in the article details below.
- Do not reuse any 4-word phrase from the source headline.
- Do not use quotes.
- Prefer a different sentence structure than the source headline.
- Keep important names, products, and numbers accurate.
- Do not introduce new brands, products, providers, or entities that are not explicitly present in the source details below.
- Do not imply a person or detail is unknown, unnamed, or undisclosed unless the source explicitly says so.
- ${params.attempt > 1 ? "Lead with a different angle than the source headline and change the opening noun phrase or verb." : "Aim for a clean newsroom-style headline."}
- Avoid these source headline phrases: ${buildForbiddenHeadlinePhrases(params.extracted).join("; ") || "n/a"}.
- ${detectCommerceArticle(params.extracted, params.sourceDomain) ? "If this is a deals/commerce story, prefer product or buyer-impact framing over salesy wording." : "Keep the tone straightforward and factual."}
${params.previousFailureReason ? `- Previous title failed this check: ${params.previousFailureReason}` : ""}

Source headline:
${params.extracted.title}

Optional context line:
${params.extracted.context || "None"}

Current rewritten body:
${params.article.body}

${params.distilledFacts ? `Distilled factual notes:\n${formatDistilledFacts(params.distilledFacts)}\n` : ""}Writer:
${params.article.writer || params.extracted.writer || "Unknown"}

Published at:
${params.article.publishedAt || params.extracted.publishedAt || "Unknown"}`;

const distillFactsForRewrite = async (params: {
  extracted: ExtractedArticle;
  processingTimeoutMs?: number;
}): Promise<DistilledFacts> => {
  const structured = rewriteModel.withStructuredOutput(factDistillationSchema);
  const result = await structured.invoke(buildFactDistillationPrompt(params.extracted), {
    signal: AbortSignal.timeout(params.processingTimeoutMs ?? appConfig.articleProcessTimeoutMs),
  });

  return normalizeDistilledFacts(result, params.extracted);
};

const rewriteTitleForPublication = async (params: {
  extracted: ExtractedArticle;
  article: PreparedArticle;
  attempt: number;
  previousFailureReason?: string;
  distilledFacts?: DistilledFacts | null;
  processingTimeoutMs?: number;
  sourceDomain?: string;
  deadline: number;
}): Promise<string> => {
  const structured = rewriteModel.withStructuredOutput(titleRewriteSchema);
  const result = await structured.invoke(
    buildTitleRewritePrompt({
      extracted: params.extracted,
      article: params.article,
      attempt: params.attempt,
      previousFailureReason: params.previousFailureReason,
      distilledFacts: params.distilledFacts,
      sourceDomain: params.sourceDomain,
    }),
    {
      signal: AbortSignal.timeout(getInvokeTimeoutMs(params.deadline, params.processingTimeoutMs ?? appConfig.articleProcessTimeoutMs)),
    },
  );

  return normalizeWhitespace(result.title);
};

export const rewriteArticleForPublication = async (params: {
  extracted: ExtractedArticle;
  sourceText: string;
  processingTimeoutMs?: number;
  sourceDomain?: string;
}): Promise<{
  article: PreparedArticle;
  modelUsed: string;
  attemptCount: number;
  strategy: "direct" | "distilled-facts";
}> => {
  const structured = rewriteModel.withStructuredOutput(rewriteSchema);
  let lastFailureReason = "Rewrite output was not original enough";
  let totalAttempts = 0;
  const deadline = createDeadline(params.processingTimeoutMs);

  const attemptRewrite = async (distilledFacts?: DistilledFacts | null): Promise<PreparedArticle | null> => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (getRemainingBudgetMs(deadline) < 12_000) {
        break;
      }

      totalAttempts += 1;
      const result = await structured.invoke(
        buildRewritePrompt({
          extracted: params.extracted,
          attempt,
          previousFailureReason: lastFailureReason,
          distilledFacts,
          sourceDomain: params.sourceDomain,
        }),
        {
          signal: AbortSignal.timeout(getInvokeTimeoutMs(deadline, params.processingTimeoutMs ?? appConfig.articleProcessTimeoutMs)),
        },
      );

      const article: PreparedArticle = {
        title: normalizeWhitespace(result.title),
        body: normalizeWhitespace(result.body),
        writer:
          normalizeOptionalWriter(result.writer) ||
          distilledFacts?.writer ||
          normalizeOptionalWriter(params.extracted.writer) ||
          null,
        publishedAt:
          normalizeOptionalDate(result.publishedAt) ||
          distilledFacts?.publishedAt ||
          normalizeOptionalDate(params.extracted.publishedAt),
      };

      const validation = validateRewrittenArticle(article, {
        extracted: params.extracted,
        sourceText: params.sourceText,
      });

      if (validation.ok) {
        return article;
      }

      if (validation.reason && /title/i.test(validation.reason)) {
        let titleFailureReason = validation.reason;

        for (let titleAttempt = 1; titleAttempt <= 2; titleAttempt += 1) {
          if (getRemainingBudgetMs(deadline) < 8_000) {
            break;
          }

          totalAttempts += 1;
          const retitledArticle: PreparedArticle = {
            ...article,
            title: await rewriteTitleForPublication({
              extracted: params.extracted,
              article,
              attempt: titleAttempt,
              previousFailureReason: titleFailureReason,
              distilledFacts,
              processingTimeoutMs: params.processingTimeoutMs,
              sourceDomain: params.sourceDomain,
              deadline,
            }),
          };
          const retitledValidation = validateRewrittenArticle(retitledArticle, {
            extracted: params.extracted,
            sourceText: params.sourceText,
          });

          if (retitledValidation.ok) {
            return retitledArticle;
          }

          titleFailureReason = retitledValidation.reason || titleFailureReason;
          if (!titleFailureReason || !/title/i.test(titleFailureReason)) {
            break;
          }
        }

        lastFailureReason = titleFailureReason || validation.reason || lastFailureReason;
        continue;
      }

      lastFailureReason = validation.reason || lastFailureReason;
    }

    return null;
  };

  const directRewrite = await attemptRewrite();
  if (directRewrite) {
    return {
      article: directRewrite,
      modelUsed: appConfig.ollamaModel,
      attemptCount: totalAttempts,
      strategy: "direct",
    };
  }

  if (getRemainingBudgetMs(deadline) < 25_000) {
    throw new Error(`Rewrite validation failed: ${lastFailureReason}`);
  }

  const distilledFacts = await distillFactsForRewrite({
    extracted: params.extracted,
    processingTimeoutMs: getInvokeTimeoutMs(deadline, params.processingTimeoutMs ?? appConfig.articleProcessTimeoutMs),
  });
  const distilledRewrite = await attemptRewrite(distilledFacts);

  if (distilledRewrite) {
    return {
      article: distilledRewrite,
      modelUsed: appConfig.ollamaModel,
      attemptCount: totalAttempts,
      strategy: "distilled-facts",
    };
  }

  throw new Error(`Rewrite validation failed: ${lastFailureReason}`);
};
