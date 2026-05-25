export const FREE_DAILY_ASK_LIMIT = 5;
export const PRO_DAILY_ASK_LIMIT = 20;

export type AskUsageSummary = {
  used: number;
  remaining: number;
  limit: number;
  progressPercent: number;
};

export type FreeAskUsageSummary = AskUsageSummary;

export function getTodayUtcDateString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getAskUsageSummary(queryCount: number | null | undefined, limit: number): AskUsageSummary {
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

export function getFreeAskUsageSummary(queryCount: number | null | undefined): FreeAskUsageSummary {
  return getAskUsageSummary(queryCount, FREE_DAILY_ASK_LIMIT);
}

export function getProAskUsageSummary(queryCount: number | null | undefined): AskUsageSummary {
  return getAskUsageSummary(queryCount, PRO_DAILY_ASK_LIMIT);
}
