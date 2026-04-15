import { describe, expect, it } from "vitest";

import { askCardSchema } from "@/lib/ask/contracts";
import { extractMarketBriefingCard } from "@/lib/ask/service/context";

describe("extractMarketBriefingCard", () => {
  it("returns the briefing card from get_market_briefing tool output", () => {
    const briefing = {
      type: "briefing" as const,
      asset: "AUDUSD",
      price: "0.72",
      change: "+0.53%",
      direction: "up" as const,
      level1: "0.72",
      level2: "0.71",
      event: null,
      verdict: "AUDUSD is holding above support.",
    };

    expect(
      extractMarketBriefingCard(
        [
          {
            toolName: "get_market_briefing",
            output: { card: briefing, uiMeta: { marketSeries: [0.7, 0.71, 0.72] } },
          },
        ],
        askCardSchema,
      ),
    ).toEqual(briefing);
  });

  it("returns null when get_market_briefing is missing", () => {
    expect(
      extractMarketBriefingCard(
        [{ toolName: "submit_ask_card", output: { card: { type: "briefing" } } }],
        askCardSchema,
      ),
    ).toBeNull();
  });
});
