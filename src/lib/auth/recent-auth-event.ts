/** Window after account creation or email confirmation where signup welcome may send. */
export const RECENT_AUTH_EVENT_WINDOW_MS = 10 * 60 * 1000;

export function isRecentAuthTimestamp(
  isoTimestamp: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!isoTimestamp) {
    return false;
  }

  const timestampMs = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestampMs)) {
    return false;
  }

  return nowMs - timestampMs <= RECENT_AUTH_EVENT_WINDOW_MS;
}
