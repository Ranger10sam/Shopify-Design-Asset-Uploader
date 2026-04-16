const LOG_PREFIX = "[design-asset-uploader]";

export function logInfo(message: string, context?: Record<string, unknown>): void {
  console.info(LOG_PREFIX, message, context ?? {});
}

export function logError(message: string, context?: Record<string, unknown>): void {
  console.error(LOG_PREFIX, message, context ?? {});
}

