import { describe, expect, it } from "vitest";

import { MARKETS_DASHBOARD_ASSETS } from "@/lib/markets/dashboard";
import {
  TRADINGVIEW_APP_SYMBOL_TABS,
  TRADINGVIEW_DEFAULT_CHART_SYMBOL,
} from "@/lib/markets/trading-view-symbols";

describe("TRADINGVIEW_DEFAULT_CHART_SYMBOL", () => {
  it("is a full TradingView symbol id", () => {
    expect(TRADINGVIEW_DEFAULT_CHART_SYMBOL).toMatch(/^[A-Z0-9_]+:/);
  });
});

describe("TRADINGVIEW_APP_SYMBOL_TABS", () => {
  it("includes one tab per markets dashboard asset", () => {
    expect(TRADINGVIEW_APP_SYMBOL_TABS.length).toBe(MARKETS_DASHBOARD_ASSETS.length);
  });

  it("uses TradingView symbol|range pairs", () => {
    for (const [, sym] of TRADINGVIEW_APP_SYMBOL_TABS) {
      expect(sym).toMatch(/\|1D$/);
      expect(sym.length).toBeGreaterThan(4);
    }
  });
});
