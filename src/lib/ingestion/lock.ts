import { randomUUID } from "node:crypto";

import { acquireAppLock, hasActiveAppLock, releaseAppLock, renewAppLock } from "@/lib/db";

const INGEST_LOCK_NAME = "ingestion";
const INGEST_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export const createIngestLockOwner = (): string => randomUUID();

export const acquireIngestLock = async (ownerId: string): Promise<boolean> => {
  return acquireAppLock(INGEST_LOCK_NAME, ownerId, INGEST_LOCK_TTL_MS);
};

export const renewIngestLock = async (ownerId: string): Promise<void> => {
  await renewAppLock(INGEST_LOCK_NAME, ownerId, INGEST_LOCK_TTL_MS);
};

export const releaseIngestLock = async (ownerId: string): Promise<void> => {
  await releaseAppLock(INGEST_LOCK_NAME, ownerId);
};

export const isIngestRunning = async (): Promise<boolean> => hasActiveAppLock(INGEST_LOCK_NAME);
