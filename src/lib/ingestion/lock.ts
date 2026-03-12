import { randomUUID } from "node:crypto";

import { acquireAppLock, hasActiveAppLock, releaseAppLock, renewAppLock } from "@/lib/db";

const INGEST_LOCK_NAME = "ingestion";
const INGEST_LOCK_TTL_MS = 2 * 60 * 60 * 1000;

export const createIngestLockOwner = (): string => randomUUID();

export const acquireIngestLock = (ownerId: string): boolean => {
  return acquireAppLock(INGEST_LOCK_NAME, ownerId, INGEST_LOCK_TTL_MS);
};

export const renewIngestLock = (ownerId: string): void => {
  renewAppLock(INGEST_LOCK_NAME, ownerId, INGEST_LOCK_TTL_MS);
};

export const releaseIngestLock = (ownerId: string): void => {
  releaseAppLock(INGEST_LOCK_NAME, ownerId);
};

export const isIngestRunning = (): boolean => hasActiveAppLock(INGEST_LOCK_NAME);
