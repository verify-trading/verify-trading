export const FREE_DAILY_ASK_LIMIT = 5;

export type FreeAskUsageSummary = {
  used: number;
  remaining: number;
  limit: number;
  progressPercent: number;
};

export function getTodayUtcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getFreeAskUsageSummary(queryCount: number | null | undefined): FreeAskUsageSummary {
  const limit = FREE_DAILY_ASK_LIMIT;
  const normalizedCount =
    typeof queryCount === "number" && Number.isFinite(queryCount) ? Math.trunc(queryCount) : 0;
  const used = Math.min(limit, Math.max(0, normalizedCount));
  const remaining = Math.max(0, limit - used);

  return {
    used,
    remaining,
    limit,
    progressPercent: (used / limit) * 100,
  };
}
