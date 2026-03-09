import { exportNewsArtifacts } from "@/lib/export-news";

const run = async () => {
  await exportNewsArtifacts();
  console.log("News artifacts exported.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});