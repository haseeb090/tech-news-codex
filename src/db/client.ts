import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { appConfig, isProduction } from "@/lib/config";
import * as schema from "@/db/schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as typeof globalThis & {
  __techNewsClient?: ReturnType<typeof createClient>;
  __techNewsDb?: DbClient;
};

const getClient = () => {
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForDb.__techNewsClient) {
    globalForDb.__techNewsClient = createClient({
      url: appConfig.databaseUrl,
      authToken: appConfig.databaseAuthToken || undefined,
    });
  }

  return globalForDb.__techNewsClient;
};

export const getDb = (): DbClient => {
  if (!globalForDb.__techNewsDb) {
    globalForDb.__techNewsDb = drizzle(getClient(), { schema });
  }

  return globalForDb.__techNewsDb;
};

export const closeDb = async (): Promise<void> => {
  if (globalForDb.__techNewsClient) {
    await globalForDb.__techNewsClient.close();
  }

  delete globalForDb.__techNewsClient;
  delete globalForDb.__techNewsDb;
};

if (isProduction) {
  delete globalForDb.__techNewsClient;
  delete globalForDb.__techNewsDb;
}
