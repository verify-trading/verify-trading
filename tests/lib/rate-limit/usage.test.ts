import { describe, expect, it } from "vitest";

import {
  FREE_DAILY_ASK_LIMIT,
  getFreeAskUsageSummary,
  getTodayUtcDateString,
} from "@/lib/rate-limit/usage";

describe("rate-limit usage helpers", () => {
  it("returns the UTC calendar date string", () => {
    expect(getTodayUtcDateString(new Date("2026-04-08T23:59:59.000Z"))).toBe("2026-04-08");
  });

  it("builds a capped free-plan usage summary", () => {
    expect(getFreeAskUsageSummary(3)).toEqual({
      used: 3,
      remaining: FREE_DAILY_ASK_LIMIT - 3,
      limit: FREE_DAILY_ASK_LIMIT,
      progressPercent: 60,
    });
  });

  it("clamps invalid usage counts into the free-plan range", () => {
    expect(getFreeAskUsageSummary(99)).toEqual({
      used: FREE_DAILY_ASK_LIMIT,
      remaining: 0,
      limit: FREE_DAILY_ASK_LIMIT,
      progressPercent: 100,
    });
    expect(getFreeAskUsageSummary(-4)).toEqual({
      used: 0,
      remaining: FREE_DAILY_ASK_LIMIT,
      limit: FREE_DAILY_ASK_LIMIT,
      progressPercent: 0,
    });
  });
});
