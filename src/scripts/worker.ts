import { closeDb } from "@/lib/db";
import { acquireIngestLock, createIngestLockOwner, releaseIngestLock } from "@/lib/ingestion/lock";
import { appConfig } from "@/lib/config";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runLoop = async () => {
  console.log(`[worker] starting with interval ${appConfig.workerIntervalMinutes} minutes`);

  while (true) {
    const ownerId = createIngestLockOwner();

    try {
      if (!(await acquireIngestLock(ownerId))) {
        console.log("[worker] skipping because another ingestion is already running");
      } else {
        const summary = await runIngestionPipeline({ trigger: "scheduled", lockOwner: ownerId });
        console.log("[worker] run complete", summary);
      }
    } catch (error) {
      console.error("[worker] run failed", error);
    } finally {
      await releaseIngestLock(ownerId);
      await closeDb();
    }

    await wait(appConfig.workerIntervalMinutes * 60 * 1000);
  }
};

runLoop().catch((error) => {
  console.error(error);
  process.exit(1);
});
