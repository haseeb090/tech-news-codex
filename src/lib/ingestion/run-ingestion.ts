import pLimit from "p-limit";

import { appConfig } from "@/lib/config";
import {
  failIngestRun,
  finalizeIngestRun,
  getLinksByIds,
  isLinkEligibleForProcessing,
  markLinkFailure,
  persistSuccessfulArticle,
  recordAttempt,
  registerFeedIfMissing,
  startIngestRun,
  updateIngestRunDiscovery,
  updateIngestRunProgress,
  upsertDiscoveredLink,
} from "@/lib/db";
import { exportNewsArtifacts } from "@/lib/export-news";
import { runArticleExtractionGraph } from "@/lib/ingestion/article-graph";
import { renewIngestLock } from "@/lib/ingestion/lock";
import { fetchFeedLinks } from "@/lib/ingestion/rss";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { getSourceDomain, normalizeUrl } from "@/lib/url-utils";
import type { IngestionRunSummary } from "@/lib/types";

interface IngestionOptions {
  trigger: IngestionRunSummary["trigger"];
  lockOwner?: string;
}

export const runIngestionPipeline = async (
  options: IngestionOptions,
): Promise<IngestionRunSummary> => {
  logInfo("Starting ingestion run", { trigger: options.trigger });
  const runId = startIngestRun(options.trigger, 0, 0, 0);
  const runStartedAt = new Date().toISOString();

  try {
    const linkIdsToProcess = new Set<number>();
    let totalDiscovered = 0;
    let newLinks = 0;

    for (const feedUrl of appConfig.rssFeeds) {
      registerFeedIfMissing(feedUrl);
      if (options.lockOwner) renewIngestLock(options.lockOwner);

      try {
        const items = await fetchFeedLinks(feedUrl);
        totalDiscovered += items.length;

        for (const item of items) {
          try {
            const normalizedUrl = normalizeUrl(item.link);
            const sourceDomain = getSourceDomain(normalizedUrl);
            const { link, isNew } = upsertDiscoveredLink(
              item.feedUrl,
              item.link,
              normalizedUrl,
              sourceDomain,
            );

            if (isNew) newLinks += 1;
            if (isLinkEligibleForProcessing(link)) {
              linkIdsToProcess.add(link.id);
            }
          } catch (error) {
            logWarn("Failed to normalize/discover URL", {
              link: item.link,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        logWarn("Failed to fetch RSS feed", {
          feedUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const queuedIds = [...linkIdsToProcess];
    updateIngestRunDiscovery(runId, {
      totalLinks: totalDiscovered,
      newLinks,
      queuedForProcessing: queuedIds.length,
    });

    const queuedLinks = getLinksByIds(queuedIds);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const limit = pLimit(appConfig.ingestionConcurrency);
    const publishProgress = (currentItemUrl: string | null) => {
      updateIngestRunProgress(runId, {
        processed,
        succeeded,
        failed,
        currentItemUrl,
      });

      if (options.lockOwner) {
        renewIngestLock(options.lockOwner);
      }

      if (processed > 0 && (processed % 5 === 0 || processed === queuedLinks.length)) {
        logInfo("Ingestion progress", {
          runId,
          processed,
          queued: queuedLinks.length,
          succeeded,
          failed,
        });
      }
    };

    await Promise.all(
      queuedLinks.map((link) =>
        limit(async () => {
          const startedAt = Date.now();
          publishProgress(link.normalizedUrl);

          try {
            const { extracted, modelUsed } = await runArticleExtractionGraph(link.normalizedUrl);

            persistSuccessfulArticle({
              linkId: link.id,
              normalizedUrl: link.normalizedUrl,
              sourceDomain: link.sourceDomain,
              extracted,
            });

            recordAttempt({
              runId,
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              status: "success",
              modelUsed: modelUsed || undefined,
              durationMs: Date.now() - startedAt,
            });

            succeeded += 1;
            processed += 1;
            publishProgress(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            markLinkFailure(link.id, message);
            recordAttempt({
              runId,
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              status: "failed",
              errorMessage: message,
              durationMs: Date.now() - startedAt,
            });

            failed += 1;
            processed += 1;
            publishProgress(null);
            logError("Article processing failed", { url: link.normalizedUrl, error: message });
          }
        }),
      ),
    );

    await exportNewsArtifacts();

    const summary: IngestionRunSummary = {
      runId,
      trigger: options.trigger,
      startedAt: runStartedAt,
      finishedAt: new Date().toISOString(),
      totalLinks: totalDiscovered,
      newLinks,
      queuedForProcessing: queuedIds.length,
      processed,
      succeeded,
      failed,
    };

    finalizeIngestRun(summary);
    logInfo("Ingestion run completed", summary);

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failIngestRun(runId, message);
    logError("Ingestion run failed", { runId, error: message });
    throw error;
  }
};
