import "@/lib/load-env";

import { closeDb, getDb } from "@/db/client";
import {
  appLocks,
  articleAttempts,
  articleLinks,
  articles,
  feeds,
  ingestEvents,
  ingestRuns,
  loginAudit,
  rateLimits,
  readerSignupEvents,
  readerUsers,
} from "@/db/schema";
import { exportNewsArtifacts } from "@/lib/export-news";

async function main() {
  const db = getDb();

  await db.delete(readerSignupEvents);
  await db.delete(readerUsers);
  await db.delete(loginAudit);
  await db.delete(rateLimits);
  await db.delete(appLocks);
  await db.delete(ingestEvents);
  await db.delete(articleAttempts);
  await db.delete(ingestRuns);
  await db.delete(articles);
  await db.delete(articleLinks);
  await db.delete(feeds);

  await exportNewsArtifacts();
  console.log("Database cleared and export artifacts reset.");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
