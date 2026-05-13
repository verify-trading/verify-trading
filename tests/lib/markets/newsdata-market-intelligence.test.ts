import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

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
    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).toContain("Today is");
    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).toContain("April CPI/latest CPI data");
    expect(snapshot.items).toHaveLength(3);
    expect(snapshot.sourceCount).toBe(2);
    expect(snapshot.items[0]?.title).toBe("Gold bid firms while dollar traders wait on Fed");
    expect(snapshot.items[0]?.source).toBe("verify.trading AI");
    expect(snapshot.items[0]?.category).toBe("Market Summary");
    expect(snapshot.items[1]?.title).toBe("Gold rises as oil steadies");
    expect(snapshot.items[2]?.title).toBe("Dollar holds gains before Fed decision");
  });

  it("throws when no upstream query returns headlines", async () => {
    vi.mocked(fetchNewsEverything).mockResolvedValue({ query: "x", articles: [] });

    await expect(getMarketIntelligenceSnapshot()).rejects.toThrow(/temporarily unavailable/i);
  });

  it("filters stale, duplicate, and low-quality source headlines before summarizing", async () => {
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
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        title: "Dollar firms after latest CPI data",
        summary: "Traders are repricing policy risk after the latest inflation release.",
      }),
    } as Awaited<ReturnType<typeof generateText>>);

    const snapshot = await getMarketIntelligenceSnapshot();

    expect(snapshot.sourceCount).toBe(1);
    expect(snapshot.items.map((item) => item.title)).toEqual([
      "Dollar firms after latest CPI data",
      "US dollar firms after latest CPI data",
    ]);
  });
});
