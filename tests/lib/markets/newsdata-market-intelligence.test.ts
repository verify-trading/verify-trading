import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/newsdata", () => ({
  fetchNewsEverything: vi.fn(),
}));

import { fetchNewsEverything } from "@/lib/ask/newsdata";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";

describe("getMarketIntelligenceSnapshot (NewsData)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("fetches and deduplicates source headlines", async () => {
    vi.mocked(fetchNewsEverything)
      .mockResolvedValueOnce({
        query: "forex market",
        articles: [
          {
            title: "Dollar holds gains before Fed decision",
            source: "Reuters",
            url: "https://example.com/fed",
            publishedAt: "2026-05-05T09:00:00Z",
            description: "FX traders wait for the Fed.",
          },
        ],
      })
      .mockResolvedValueOnce({
        query: "gold oil commodities",
        articles: [
          {
            title: "Gold rises as oil steadies",
            source: "MarketWatch",
            url: "https://example.com/gold",
            publishedAt: "2026-05-05T10:00:00Z",
            description: "Commodities update.",
          },
          {
            title: "Dollar holds gains before Fed decision",
            source: "Reuters",
            url: "https://example.com/fed",
            publishedAt: "2026-05-05T09:00:00Z",
            description: "Duplicate.",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("crypto failed"))
      .mockResolvedValueOnce({
        query: "Federal Reserve inflation markets",
        articles: [],
      });

    const snapshot = await getMarketIntelligenceSnapshot();

    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.sourceCount).toBe(2);
    expect(snapshot.items[0]?.title).toBe("Gold rises as oil steadies");
    expect(snapshot.items[1]?.title).toBe("Dollar holds gains before Fed decision");
  });

  it("throws when no upstream query returns headlines", async () => {
    vi.mocked(fetchNewsEverything).mockResolvedValue({ query: "x", articles: [] });

    await expect(getMarketIntelligenceSnapshot()).rejects.toThrow(/temporarily unavailable/i);
  });

  it("filters stale, duplicate, and low-quality source headlines", async () => {
    vi.mocked(fetchNewsEverything)
      .mockResolvedValueOnce({
        query: "forex market",
        articles: [
          {
            title: "US dollar firms after latest CPI data",
            source: "Reuters",
            url: "https://example.com/fresh",
            publishedAt: "2026-05-06T09:00:00Z",
            description: "The dollar rose as traders assessed the latest inflation release.",
          },
          {
            title: "ONLY AVAILABLE IN PAID PLANS",
            source: "NewsData",
            url: "https://example.com/paid",
            publishedAt: "2026-05-06T09:00:00Z",
            description: "ONLY AVAILABLE IN PAID PLANS",
          },
          {
            title: "Old oil story",
            source: "Archive",
            url: "https://example.com/old",
            publishedAt: "2026-05-01T09:00:00Z",
            description: "Too old for the market radar.",
          },
        ],
      })
      .mockResolvedValueOnce({
        query: "gold oil commodities",
        articles: [
          {
            title: "US dollar firms after latest CPI data",
            source: "Reuters",
            url: "https://example.com/fresh",
            publishedAt: "2026-05-06T09:00:00Z",
            description: "Duplicate URL.",
          },
        ],
      })
      .mockResolvedValueOnce({ query: "bitcoin crypto market", articles: [] })
      .mockResolvedValueOnce({ query: "Federal Reserve inflation markets", articles: [] });

    const snapshot = await getMarketIntelligenceSnapshot();

    expect(snapshot.sourceCount).toBe(1);
    expect(snapshot.items.map((item) => item.title)).toEqual([
      "US dollar firms after latest CPI data",
    ]);
  });
});
