import { runIngestionPipeline } from "@/lib/ingestion/run-ingestion";

const run = async () => {
  const summary = await runIngestionPipeline({ trigger: "scheduled" });
  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});