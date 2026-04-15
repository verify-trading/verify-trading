import { describe, expect, it } from "vitest";

import { formatMarketPrice } from "@/lib/ask/market-format";

describe("formatMarketPrice", () => {
  it("keeps four decimals for non-JPY forex pairs", () => {
    expect(formatMarketPrice(0.712616, { asset: "AUD/USD", symbol: "AUDUSD" })).toBe("0.7126");
    expect(formatMarketPrice(1.1005, { asset: "EUR/USD", symbol: "EUR/USD" })).toBe("1.1005");
  });

  it("keeps three decimals for JPY forex pairs", () => {
    expect(formatMarketPrice(150.1234, { asset: "USD/JPY", symbol: "USDJPY" })).toBe("150.123");
  });

  it("uses sensible fallback precision for non-forex instruments", () => {
    expect(formatMarketPrice(4700.5, { asset: "GOLD", symbol: "GCUSD" })).toBe("4700.50");
    expect(formatMarketPrice(0.045678, { asset: "PENNY", symbol: "PENNY" })).toBe("0.04568");
  });
});
