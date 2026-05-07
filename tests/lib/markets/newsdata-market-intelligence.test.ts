import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/newsdata", () => ({
  fetchNewsEverything: vi.fn(),
}));

import { fetchNewsEverything } from "@/lib/ask/newsdata";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";

describe("getMarketIntelligenceSnapshot (NewsData)", () => {
  it("merges, dedupes, and sorts market headlines", async () => {
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
    expect(snapshot.items[0]?.title).toBe("Gold rises as oil steadies");
    expect(snapshot.items[0]?.category).toBe("Commodities");
    expect(snapshot.items[1]?.title).toBe("Dollar holds gains before Fed decision");
  });

  it("throws when no upstream query returns headlines", async () => {
    vi.mocked(fetchNewsEverything).mockResolvedValue({ query: "x", articles: [] });

    await expect(getMarketIntelligenceSnapshot()).rejects.toThrow(/temporarily unavailable/i);
  });
});
