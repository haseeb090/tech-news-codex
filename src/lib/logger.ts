const timestamp = (): string => new Date().toISOString();

export const logInfo = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.log(`[${timestamp()}] [INFO] ${message}`);
    return;
  }
  console.log(`[${timestamp()}] [INFO] ${message}`, extra);
};

export const logWarn = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.warn(`[${timestamp()}] [WARN] ${message}`);
    return;
  }
  console.warn(`[${timestamp()}] [WARN] ${message}`, extra);
};

export const logError = (message: string, extra?: unknown): void => {
  if (extra === undefined) {
    console.error(`[${timestamp()}] [ERROR] ${message}`);
    return;
  }
  console.error(`[${timestamp()}] [ERROR] ${message}`, extra);
};
