import { logger } from "@/lib/observability/logger";

export function logEmailError(message: string, context: Record<string, unknown>, error: unknown): void {
  logger.warn(message, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
}
