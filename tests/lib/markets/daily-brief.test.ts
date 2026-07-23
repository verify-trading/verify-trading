import { describe, expect, it, vi } from "vitest";

import {
  generateDailyMarketBrief,
  shouldRefreshDailyMarketBrief,
} from "@/lib/markets/daily-brief";
import type { DailyMarketBrief } from "@/lib/markets/market-intelligence";

vi.mock("@ai-sdk/anthropic", () => ({ anthropic: () => "mock-model" }));

// Model returns deliberately wrong levels; the live-price override must win.
vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: {
      date: "2026-06-16",
      overview: "Overview.",
      gold: { level: "9999", bias: "Bullish", verdict: "x" },
      oil: { level: "1", bias: "Neutral", verdict: "x" },
      dxy: { level: "200", bias: "Bullish", verdict: "x" },
      usdjpy: { level: "1", bias: "Bullish", verdict: "x" },
      eurusd: { level: "1", bias: "Bearish", verdict: "x" },
      gbpusd: { level: "1", bias: "Bearish", verdict: "x" },
      session_tone: "Tone.",
    },
  })),
}));

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

describe("generateDailyMarketBrief", () => {
  it("overrides model levels with the live quote prices (never the prompt example)", async () => {
    const brief = await generateDailyMarketBrief(new Date("2026-06-16T09:00:00.000Z"), [], {
      "XAU/USD": { price: 4361.8 },
      "WTI/USD": { price: 72.5 },
      "USD/JPY": { price: 157.2 },
      "EUR/USD": { price: 1.085 },
      "GBP/USD": { price: 1.29 },
    });

    expect(brief.gold.level).toBe("4361.80");
    expect(brief.oil.level).toBe("72.50");
    expect(brief.usdjpy?.level).toBe("157.20");
    expect(brief.eurusd.level).toBe("1.0850");
    expect(brief.gbpusd.level).toBe("1.2900");
    // DXY has no live feed, so the model's estimate is kept.
    expect(brief.dxy?.level).toBe("200");
  });
});

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
