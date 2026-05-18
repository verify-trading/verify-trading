import { describe, expect, it } from "vitest";

import { shouldRefreshDailyMarketBrief } from "@/lib/markets/daily-brief";
import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";

const baseBrief: DailyMarketBrief = {
  date: "2026-05-18",
  generatedAt: "2026-05-18T08:00:00.000Z",
  overview: "Markets are watching the dollar.",
  gold: {
    level: "2380",
    bias: "Bullish",
    verdict: "Gold is firm.",
  },
  oil: {
    level: "84.20",
    bias: "Bullish",
    verdict: "Oil is firm.",
  },
  eurusd: {
    level: "1.0820",
    bias: "Bearish",
    verdict: "Dollar pressure is showing.",
  },
  gbpusd: {
    level: "1.2850",
    bias: "Bearish",
    verdict: "Sterling is soft.",
  },
  session_tone: "Dollar strength is the main focus.",
};

describe("shouldRefreshDailyMarketBrief", () => {
  it("refreshes same-day cached briefs that do not include dollar chips", () => {
    expect(
      shouldRefreshDailyMarketBrief(
        baseBrief,
        "2026-05-18T08:10:00.000Z",
        new Date("2026-05-18T09:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("keeps same-day cached briefs that include DXY or USDJPY", () => {
    expect(
      shouldRefreshDailyMarketBrief(
        {
          ...baseBrief,
          dxy: {
            level: "105.20",
            bias: "Bullish",
            verdict: "Dollar bid controls risk.",
          },
        },
        "2026-05-18T08:10:00.000Z",
        new Date("2026-05-18T09:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
