import "@/lib/load-env";

import pLimit from "p-limit";

import { closeDb, persistSuccessfulArticle, queryArticles } from "@/lib/db";
import { exportNewsArtifacts } from "@/lib/export-news";
import { runArticleExtractionGraph } from "@/lib/ingestion/article-graph";

const parseLimit = (): number => {
  const raw = process.argv[2];
  const parsed = raw ? Number.parseInt(raw, 10) : 100;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
};

async function main() {
  const limit = parseLimit();
  const concurrency = 3;
  const { items } = await queryArticles({
    offset: 0,
    limit,
    sort: "newest",
  });

  console.log(`Backfilling rewritten briefings for ${items.length} article(s) with concurrency ${concurrency}.`);

  const limiter = pLimit(concurrency);
  let succeeded = 0;
  let failed = 0;

  await Promise.all(
    items.map((item, index) =>
      limiter(async () => {
        try {
          console.log(`[${index + 1}/${items.length}] Rewriting ${item.canonicalUrl}`);
          const { article, modelUsed } = await runArticleExtractionGraph(item.canonicalUrl);
          await persistSuccessfulArticle({
            linkId: item.linkId,
            normalizedUrl: item.canonicalUrl,
            sourceDomain: item.sourceDomain,
            article,
            modelUsed,
          });
          succeeded += 1;
        } catch (error) {
          failed += 1;
          console.error(
            `[${index + 1}/${items.length}] Failed ${item.canonicalUrl}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    ),
  );

  await exportNewsArtifacts();
  console.log(`Backfill complete. Succeeded: ${succeeded}. Failed: ${failed}.`);
}

void main().finally(async () => {
  await closeDb();
});
