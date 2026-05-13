import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ask/newsdata", () => ({
  fetchNewsEverything: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((model: string) => model),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import { fetchNewsEverything } from "@/lib/ask/newsdata";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";
import { generateText } from "ai";

describe("getMarketIntelligenceSnapshot (NewsData)", () => {
  it("merges source headlines and asks Claude for a market summary", async () => {
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
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        title: "Gold bid firms while dollar traders wait on Fed",
        summary: "Commodities are catching a defensive bid while FX traders wait for the next Fed signal.",
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    const snapshot = await getMarketIntelligenceSnapshot();

    expect(generateText).toHaveBeenCalledOnce();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.sourceCount).toBe(2);
    expect(snapshot.items[0]?.title).toBe("Gold bid firms while dollar traders wait on Fed");
    expect(snapshot.items[0]?.source).toBe("verify.trading AI");
    expect(snapshot.items[0]?.category).toBe("Market Summary");
  });

  it("throws when no upstream query returns headlines", async () => {
    vi.mocked(fetchNewsEverything).mockResolvedValue({ query: "x", articles: [] });

    await expect(getMarketIntelligenceSnapshot()).rejects.toThrow(/temporarily unavailable/i);
  });
});
