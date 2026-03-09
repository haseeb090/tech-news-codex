let ingestRunning = false;

export const acquireIngestLock = (): boolean => {
  if (ingestRunning) return false;
  ingestRunning = true;
  return true;
};

export const releaseIngestLock = (): void => {
  ingestRunning = false;
};

export const isIngestRunning = (): boolean => ingestRunning;