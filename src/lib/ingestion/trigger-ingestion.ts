import { acquireIngestLock, createIngestLockOwner, releaseIngestLock } from "@/lib/ingestion/lock";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";
import { logError, logInfo } from "@/lib/logger";
import type { IngestionRunSummary } from "@/lib/types";

export const startBackgroundIngestion = (
  trigger: IngestionRunSummary["trigger"],
): { ok: true } | { ok: false; reason: string } => {
  const ownerId = createIngestLockOwner();

  if (!acquireIngestLock(ownerId)) {
    return { ok: false, reason: "Ingestion already running" };
  }

  setTimeout(async () => {
    try {
      await runIngestionPipeline({ trigger, lockOwner: ownerId });
    } catch (error) {
      logError("Background ingestion failed", {
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      releaseIngestLock(ownerId);
      logInfo("Background ingestion settled", { trigger });
    }
  }, 0);

  return { ok: true };
};
