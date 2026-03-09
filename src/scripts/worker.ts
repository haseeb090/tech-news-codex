import { appConfig } from "@/lib/config";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runLoop = async () => {
  console.log(`[worker] starting with interval ${appConfig.workerIntervalMinutes} minutes`);

  while (true) {
    try {
      const summary = await runIngestionPipeline({ trigger: "scheduled" });
      console.log("[worker] run complete", summary);
    } catch (error) {
      console.error("[worker] run failed", error);
    }

    await wait(appConfig.workerIntervalMinutes * 60 * 1000);
  }
};

runLoop().catch((error) => {
  console.error(error);
  process.exit(1);
});