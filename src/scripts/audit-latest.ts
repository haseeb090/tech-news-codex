import "@/lib/load-env";

import pLimit from "p-limit";
import { ChatOllama } from "@langchain/ollama";
import { z } from "zod";

import { closeDb, queryArticles } from "@/lib/db";
import { appConfig } from "@/lib/config";
import { deterministicExtract, fetchHtml, sourceTextForValidation } from "@/lib/ingestion/deterministic-extract";
import { getSourcePolicy } from "@/lib/ingestion/source-policy";
import { longestSharedWordRun, validateRewrittenArticle } from "@/lib/ingestion/rewrite-validation";

const auditSchema = z.object({
  verdict: z.enum(["pass", "borderline", "fail"]),
  factualAccuracy: z.number().int().min(1).max(5),
  coverage: z.number().int().min(1).max(5),
  clarity: z.number().int().min(1).max(5),
  importantMissingDetails: z.array(z.string()).max(5),
  unsupportedClaims: z.array(z.string()).max(5),
  notes: z.string().min(1).max(400),
});

const auditModel = new ChatOllama({
  baseUrl: appConfig.ollamaBaseUrl,
  model: appConfig.ollamaModel,
  temperature: 0,
});

const parseLimit = (): number => {
  const raw = process.argv[2];
  const parsed = raw ? Number.parseInt(raw, 10) : 8;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
};

const buildAuditPrompt = (params: {
  sourceTitle: string;
  sourceContext: string | null | undefined;
  sourceBody: string;
  rewrittenTitle: string;
  rewrittenBody: string;
}) => `You are auditing a rewritten tech-news briefing against a source article.

Judge whether the rewritten output is faithful, useful, and covers the most important facts from the source.

Scoring guidance:
- verdict=pass: factually sound and captures the central development plus the most important supporting details
- verdict=borderline: broadly accurate but noticeably incomplete, overly generic, or missing key context
- verdict=fail: materially misleading, missing central facts, or adding unsupported claims

Source article headline:
${params.sourceTitle}

Source context:
${params.sourceContext || "None"}

Source article body:
${params.sourceBody}

Rewritten headline:
${params.rewrittenTitle}

Rewritten body:
${params.rewrittenBody}`;

async function auditArticle(item: Awaited<ReturnType<typeof queryArticles>>["items"][number]) {
  const policy = getSourcePolicy(item.canonicalUrl);
  const html = await fetchHtml(item.canonicalUrl, policy.fetchTimeoutMs);
  const extracted = deterministicExtract(html, item.canonicalUrl);
  const sourceText = sourceTextForValidation(html, item.canonicalUrl);
  const rewrittenValidation = validateRewrittenArticle(
    {
      title: item.title,
      body: item.body,
      writer: item.writer,
      publishedAt: item.publishedAt,
    },
    {
      extracted,
      sourceText,
    },
  );

  const structuredAudit = auditModel.withStructuredOutput(auditSchema);
  const review = await structuredAudit.invoke(
    buildAuditPrompt({
      sourceTitle: extracted.title,
      sourceContext: extracted.context,
      sourceBody: extracted.body.slice(0, 6_000),
      rewrittenTitle: item.title,
      rewrittenBody: item.body,
    }),
    {
      signal: AbortSignal.timeout(Math.max(policy.processingTimeoutMs, 45_000)),
    },
  );

  return {
    id: item.id,
    url: item.canonicalUrl,
    source: item.sourceDomain,
    title: item.title,
    rewrittenValidation,
    sharedTitleRun: Math.max(
      longestSharedWordRun(item.title, extracted.title, 8),
      longestSharedWordRun(item.title, sourceText, 8),
    ),
    sharedBodyRun: Math.max(
      longestSharedWordRun(item.body, extracted.body, 12),
      longestSharedWordRun(item.body, sourceText, 12),
    ),
    review,
  };
}

async function main() {
  const limit = parseLimit();
  const { items } = await queryArticles({
    offset: 0,
    limit,
    sort: "newest",
  });

  if (items.length === 0) {
    console.log("No articles available to audit.");
    return;
  }

  const concurrency = 2;
  const limiter = pLimit(concurrency);

  const results = await Promise.all(
    items.map((item) =>
      limiter(async () => {
        try {
          return await auditArticle(item);
        } catch (error) {
          return {
            id: item.id,
            url: item.canonicalUrl,
            source: item.sourceDomain,
            title: item.title,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    ),
  );

  const summary = results.reduce(
    (acc, item) => {
      if ("error" in item) {
        acc.errors += 1;
        return acc;
      }

      acc[item.review.verdict] += 1;
      if (!item.rewrittenValidation.ok) {
        acc.validationFailures += 1;
      }
      return acc;
    },
    { pass: 0, borderline: 0, fail: 0, errors: 0, validationFailures: 0 },
  );

  console.log(JSON.stringify({ limit, summary, results }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
