import { closeDb } from "@/lib/db";
import { acquireIngestLock, createIngestLockOwner, releaseIngestLock } from "@/lib/ingestion/lock";
import { appConfig } from "@/lib/config";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getIntervalMs = (): number => appConfig.workerIntervalMinutes * 60 * 1000;

const getWaitUntilNextWindow = (): number => {
  const intervalMs = getIntervalMs();
  const now = Date.now();
  const remainder = now % intervalMs;
  return remainder === 0 ? intervalMs : intervalMs - remainder;
};

const runLoop = async () => {
  console.log(`[worker] starting with interval ${appConfig.workerIntervalMinutes} minutes`);
  console.log(
    `[worker] alignToInterval=${appConfig.workerAlignToInterval} runOnStart=${appConfig.workerRunOnStart}`,
  );

  let firstIteration = true;

  while (true) {
    if (!firstIteration || appConfig.workerRunOnStart) {
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
    }

    const waitMs = appConfig.workerAlignToInterval ? getWaitUntilNextWindow() : getIntervalMs();
    const nextRunAt = new Date(Date.now() + waitMs).toISOString();
    console.log(`[worker] next scheduled check at ${nextRunAt}`);
    await wait(waitMs);
    firstIteration = false;
  }
};

runLoop().catch((error) => {
  console.error(error);
  process.exit(1);
});
