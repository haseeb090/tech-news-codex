import { acquireIngestLock, createIngestLockOwner, releaseIngestLock } from "@/lib/ingestion/lock";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";
import { logError, logInfo } from "@/lib/logger";
import type { IngestionRunSummary } from "@/lib/types";

export const prepareBackgroundIngestion = async (
  trigger: IngestionRunSummary["trigger"],
): Promise<{ ok: true; run: () => Promise<void> } | { ok: false; reason: string }> => {
  const ownerId = createIngestLockOwner();
  const acquired = await acquireIngestLock(ownerId);
  if (!acquired) {
    return { ok: false as const, reason: "Ingestion already running" };
  }

  return {
    ok: true as const,
    run: async () => {
      try {
        await runIngestionPipeline({ trigger, lockOwner: ownerId });
      } catch (error) {
        logError("Background ingestion failed", {
          trigger,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await releaseIngestLock(ownerId);
        logInfo("Background ingestion settled", { trigger });
      }
    },
  };
};
