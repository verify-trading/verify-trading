import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/market", () => ({
  getMarketSeries: vi.fn(),
  deriveQuoteFromSeries: vi.fn(),
}));

import { GET } from "@/app/api/markets/route";
import { deriveQuoteFromSeries, getMarketSeries } from "@/lib/ask/market";

describe("GET /api/markets", () => {
  it("returns a public market snapshot without requiring a session", async () => {
    vi.mocked(getMarketSeries).mockResolvedValue({
      timeframe: "1W",
      closeValues: [1, 2, 3],
      support: 1,
      resistance: 3,
    } as never);
    vi.mocked(deriveQuoteFromSeries).mockReturnValue({
      price: 123,
      changePercent: 1.5,
      direction: "up",
      symbol: "GCUSD",
      asset: "GOLD",
      isMarketOpen: null,
    } as never);

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.timeframe).toBe("1W");
    expect(json.assets).toHaveLength(8);
  });

  it("sets a short public cache policy for the dashboard snapshot", async () => {
    vi.mocked(getMarketSeries).mockResolvedValue({
      timeframe: "1W",
      closeValues: [1, 2, 3],
      support: 1,
      resistance: 3,
    } as never);
    vi.mocked(deriveQuoteFromSeries).mockReturnValue({
      price: 123,
      changePercent: 1.5,
      direction: "up",
      symbol: "GCUSD",
      asset: "GOLD",
      isMarketOpen: null,
    } as never);

    const response = await GET({
      nextUrl: new URL("http://localhost/api/markets"),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=60, stale-while-revalidate=300");
  });
});
