export const logInfo = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.log(`[INFO] ${message}`);
    return;
  }
  console.log(`[INFO] ${message}`, extra);
};

export const logWarn = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.warn(`[WARN] ${message}`);
    return;
  }
  console.warn(`[WARN] ${message}`, extra);
};

export const logError = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.error(`[ERROR] ${message}`);
    return;
  }
  console.error(`[ERROR] ${message}`, extra);
};