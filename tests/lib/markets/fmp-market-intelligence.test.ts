import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/markets/fmp-json", () => ({
  fetchFmpJson: vi.fn(),
}));

import { getMarketIntelligenceSnapshot } from "@/lib/markets/fmp-market-intelligence";
import { fetchFmpJson } from "@/lib/markets/fmp-json";

describe("getMarketIntelligenceSnapshot", () => {
  it("returns partial results when one upstream feed fails", async () => {
    vi.mocked(fetchFmpJson)
      .mockRejectedValueOnce(new Error("general failed"))
      .mockResolvedValueOnce([
        {
          title: "FX market update",
          site: "Reuters",
          url: "https://example.com/fx",
          publishedDate: "2026-04-15T08:30:00Z",
          text: "Dollar holds gains.",
        },
      ]);

    const snapshot = await getMarketIntelligenceSnapshot();

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.title).toBe("FX market update");
    expect(snapshot.items[0]?.category).toBe("Forex");
  });

  it("throws when both upstream feeds fail", async () => {
    vi.mocked(fetchFmpJson)
      .mockRejectedValueOnce(new Error("general failed"))
      .mockRejectedValueOnce(new Error("forex failed"));

    await expect(getMarketIntelligenceSnapshot()).rejects.toThrow(
      /temporarily unavailable/i,
    );
  });
});
