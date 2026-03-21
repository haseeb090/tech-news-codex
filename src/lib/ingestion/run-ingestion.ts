import pLimit from "p-limit";

import { appConfig } from "@/lib/config";
import {
  failStaleIngestRuns,
  failIngestRun,
  finalizeIngestRun,
  getLinksByIds,
  getLastCompletedRun,
  isLinkEligibleForProcessing,
  markLinkFailure,
  persistSuccessfulArticle,
  recordIngestEvent,
  recordAttempt,
  registerFeedIfMissing,
  startIngestRun,
  updateIngestRunDiscovery,
  updateIngestRunProgress,
  upsertDiscoveredLink,
} from "@/lib/db";
import { exportNewsArtifacts } from "@/lib/export-news";
import { runArticleExtractionGraph, type ArticleGraphEvent } from "@/lib/ingestion/article-graph";
import { renewIngestLock } from "@/lib/ingestion/lock";
import { getNonNewsReason } from "@/lib/ingestion/newsworthiness";
import { fetchFeedLinks } from "@/lib/ingestion/rss";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { getSourceDomain, normalizeUrl } from "@/lib/url-utils";
import type { IngestionRunSummary } from "@/lib/types";

interface IngestionOptions {
  trigger: IngestionRunSummary["trigger"];
  lockOwner?: string;
}

const createRunEventLogger = (runId: number) => {
  return async (event: {
    level?: "info" | "warn" | "error";
    stage: string;
    message: string;
    linkId?: number | null;
    articleUrl?: string | null;
    details?: Record<string, unknown> | null;
  }) => {
    const level = event.level || "info";
    const payload = {
      stage: event.stage,
      runId,
      linkId: event.linkId || null,
      articleUrl: event.articleUrl || null,
      ...(event.details || {}),
    };
    const consoleMessage = `[${event.stage}] ${event.message}`;

    if (level === "error") {
      logError(consoleMessage, payload);
    } else if (level === "warn") {
      logWarn(consoleMessage, payload);
    } else {
      logInfo(consoleMessage, payload);
    }

    await recordIngestEvent({
      runId,
      level,
      stage: event.stage,
      message: event.message,
      linkId: event.linkId,
      articleUrl: event.articleUrl,
      details: event.details,
    });
  };
};

export const runIngestionPipeline = async (
  options: IngestionOptions,
): Promise<IngestionRunSummary> => {
  logInfo("Starting ingestion run", { trigger: options.trigger });
  await failStaleIngestRuns("Recovered from an interrupted ingestion run.");
  const runId = await startIngestRun(options.trigger, 0, 0, 0);
  const emitRunEvent = createRunEventLogger(runId);
  const runStartedAt = new Date().toISOString();
  const previousCompletedRun = await getLastCompletedRun();

  await emitRunEvent({
    stage: "run.start",
    message: "Started ingestion run",
    details: {
      trigger: options.trigger,
      previousCompletedRunId: previousCompletedRun?.runId || null,
      rssFeedCount: appConfig.rssFeeds.length,
      concurrency: appConfig.ingestionConcurrency,
    },
  });

  try {
    const linkIdsToProcess = new Set<number>();
    let totalDiscovered = 0;
    let newLinks = 0;
    let skippedNonNews = 0;

    for (const feedUrl of appConfig.rssFeeds) {
      await registerFeedIfMissing(feedUrl);
      if (options.lockOwner) await renewIngestLock(options.lockOwner);
      await emitRunEvent({
        stage: "feed.fetch.start",
        message: "Fetching RSS feed",
        details: { feedUrl },
      });

      try {
        const items = await fetchFeedLinks(feedUrl);
        let skippedFromFeed = 0;
        totalDiscovered += items.length;

        for (const item of items) {
          try {
            const normalizedUrl = normalizeUrl(item.link);
            const sourceDomain = getSourceDomain(normalizedUrl);
            const nonNewsReason = getNonNewsReason({
              url: normalizedUrl,
              sourceDomain,
              title: item.title,
            });

            if (nonNewsReason) {
              skippedNonNews += 1;
              skippedFromFeed += 1;
              continue;
            }

            const { link, isNew } = await upsertDiscoveredLink(
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

        await emitRunEvent({
          stage: "feed.fetch.success",
          message: "Fetched RSS feed",
          details: {
            feedUrl,
            discoveredLinks: items.length,
            skippedNonNews: skippedFromFeed,
          },
        });
      } catch (error) {
        await emitRunEvent({
          level: "warn",
          stage: "feed.fetch.failed",
          message: "Failed to fetch RSS feed",
          details: {
            feedUrl,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        logWarn("Failed to fetch RSS feed", {
          feedUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const queuedIds = [...linkIdsToProcess];
    await updateIngestRunDiscovery(runId, {
      totalLinks: totalDiscovered,
      newLinks,
      queuedForProcessing: queuedIds.length,
    });
    await emitRunEvent({
      stage: "run.discovery.completed",
      message: "Completed feed discovery",
      details: {
        totalDiscovered,
        newLinks,
        queuedForProcessing: queuedIds.length,
        skippedNonNews,
      },
    });

    const queuedLinks = (await getLinksByIds(queuedIds)).sort((left, right) => {
      if (left.retryCount !== right.retryCount) {
        return left.retryCount - right.retryCount;
      }

      return new Date(right.firstSeenAt).getTime() - new Date(left.firstSeenAt).getTime();
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let lastPublishedProgress = -1;

    const limit = pLimit(appConfig.ingestionConcurrency);
    const publishProgress = async (currentItemUrl: string | null) => {
      await updateIngestRunProgress(runId, {
        processed,
        succeeded,
        failed,
        currentItemUrl: currentItemUrl === null ? undefined : currentItemUrl,
      });

      if (options.lockOwner) {
        await renewIngestLock(options.lockOwner);
      }

      if (processed > 0 && processed !== lastPublishedProgress && (processed % 5 === 0 || processed === queuedLinks.length)) {
        lastPublishedProgress = processed;
        await emitRunEvent({
          stage: "run.progress",
          message: "Updated ingestion progress",
          details: {
            processed,
            queued: queuedLinks.length,
            succeeded,
            failed,
            currentItemUrl: currentItemUrl || null,
          },
        });
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
          await emitRunEvent({
            stage: "link.process.start",
            message: "Starting article orchestration",
            linkId: link.id,
            articleUrl: link.normalizedUrl,
            details: {
              sourceDomain: link.sourceDomain,
              retryCount: link.retryCount,
            },
          });
          await publishProgress(link.normalizedUrl);

          try {
            const { article, modelUsed, diagnostics } = await runArticleExtractionGraph(
              link.normalizedUrl,
              async (event: ArticleGraphEvent) => {
                await emitRunEvent({
                  level: event.level,
                  stage: event.stage,
                  message: event.message,
                  linkId: link.id,
                  articleUrl: link.normalizedUrl,
                  details: event.details || undefined,
                });
              },
            );

            await persistSuccessfulArticle({
              linkId: link.id,
              normalizedUrl: link.normalizedUrl,
              sourceDomain: link.sourceDomain,
              article,
              modelUsed,
            });

            await recordAttempt({
              runId,
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              status: "success",
              modelUsed: modelUsed || undefined,
              agentOutput: {
                title: article.title,
                body: article.body,
                writer: article.writer,
                publishedAt: article.publishedAt,
                outputKind: "paraphrased-summary",
                diagnostics,
              },
              durationMs: Date.now() - startedAt,
            });

            succeeded += 1;
            processed += 1;
            await emitRunEvent({
              stage: "link.process.success",
              message: "Article orchestration completed successfully",
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              details: {
                modelUsed: modelUsed || appConfig.ollamaModel,
                durationMs: Date.now() - startedAt,
                title: article.title,
                outputKind: "paraphrased-summary",
              },
            });
            await publishProgress(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            await markLinkFailure(link.id, message);
            await recordAttempt({
              runId,
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              status: "failed",
              errorMessage: message,
              agentOutput: { error: message },
              durationMs: Date.now() - startedAt,
            });

            failed += 1;
            processed += 1;
            await emitRunEvent({
              level: "error",
              stage: "link.process.failed",
              message: "Article orchestration failed",
              linkId: link.id,
              articleUrl: link.normalizedUrl,
              details: {
                sourceDomain: link.sourceDomain,
                error: message,
                durationMs: Date.now() - startedAt,
              },
            });
            await publishProgress(null);
            logError("Article processing failed", { url: link.normalizedUrl, error: message });
          }
        }),
      ),
    );

    if (succeeded > 0) {
      await emitRunEvent({
        stage: "run.export.start",
        message: "Exporting frontend news artifacts",
        details: { succeeded },
      });
      await exportNewsArtifacts();
      await emitRunEvent({
        stage: "run.export.completed",
        message: "Exported frontend news artifacts",
        details: { succeeded },
      });
    }

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

    await finalizeIngestRun(summary);
    await emitRunEvent({
      stage: "run.completed",
      message: "Ingestion run completed",
      details: { ...summary },
    });
    logInfo("Ingestion run completed", summary);

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failIngestRun(runId, message);
    await emitRunEvent({
      level: "error",
      stage: "run.failed",
      message: "Ingestion run failed",
      details: {
        runId,
        error: message,
      },
    });
    logError("Ingestion run failed", { runId, error: message });
    throw error;
  }
};
