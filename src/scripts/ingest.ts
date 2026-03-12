import { closeDb } from "@/lib/db";
import { acquireIngestLock, createIngestLockOwner, releaseIngestLock } from "@/lib/ingestion/lock";
import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";

const run = async () => {
  const ownerId = createIngestLockOwner();
  if (!acquireIngestLock(ownerId)) {
    throw new Error("Ingestion already running");
  }

  try {
    const summary = await runIngestionPipeline({ trigger: "scheduled", lockOwner: ownerId });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    releaseIngestLock(ownerId);
    closeDb();
  }

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
