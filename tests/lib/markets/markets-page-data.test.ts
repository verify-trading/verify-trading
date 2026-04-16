import { describe, expect, it } from "vitest";

import type { MarketsAssetPayload } from "@/lib/markets/dashboard";

import { buildSparklinePath, buildTile, marketCatalog } from "@/lib/markets/markets-page-data";

describe("buildSparklinePath", () => {
  it("maps varying closes across the vertical band", () => {
    const path = buildSparklinePath([10, 20, 15], 100, 40);
    expect(path).toMatch(/M 0\.00 34\.00/);
    expect(path).toMatch(/L 50\.00 6\.00/);
    expect(path).toMatch(/L 100\.00 20\.00/);
  });

  it("draws a flat line at mid height when all closes are identical", () => {
    const path = buildSparklinePath([1.17, 1.17, 1.17, 1.17], 90, 40);
    expect(path).toMatch(/L 30\.00 20\.00/);
    expect(path).toMatch(/L 60\.00 20\.00/);
    expect(path).toMatch(/L 90\.00 20\.00/);
  });
});

describe("buildTile", () => {
  it("keeps percent change, absolute change, price, and sparkline aligned on one series", () => {
    const gold = marketCatalog.find((i) => i.id === "gold")!;
    const closes = [2900, 2950, 3000];
    const first = closes[0]!;
    const last = closes[closes.length - 1]!;
    const expectedPct = ((last - first) / first) * 100;

    const asset: MarketsAssetPayload = {
      id: "gold",
      label: "GOLD",
      quote: {
        asset: "GOLD",
        symbol: "GCUSD",
        price: last,
        changePercent: expectedPct,
        direction: "up",
        isMarketOpen: null,
      },
      series: {
        asset: "GOLD",
        symbol: "GCUSD",
        timeframe: "1W",
        closeValues: closes,
        support: Math.min(...closes),
        resistance: Math.max(...closes),
      },
      error: null,
    };

    const tile = buildTile(gold, asset, "1W", "2026-01-01T00:00:00.000Z");

    expect(tile.sparkline).toEqual(closes);
    expect(tile.changePercent).toBe(`${expectedPct >= 0 ? "+" : ""}${expectedPct.toFixed(2)}%`);
    expect(tile.changeValue.startsWith("+")).toBe(true);
    expect(parseFloat(tile.changeValue.replace(/[^\d.-]/g, ""))).toBeCloseTo(last - first, 5);
  });
});
