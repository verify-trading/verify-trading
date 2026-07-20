import { describe, expect, it } from "vitest";

import { askCardSchema } from "@/lib/ask/contracts";
import { extractMarketBriefingCard, extractUiMeta } from "@/lib/ask/service/context";

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

describe("extractUiMeta", () => {
  it("preserves prop-firm Trustpilot and curated evidence metadata", () => {
    const card = {
      type: "broker" as const,
      name: "Alpha Futures",
      score: "Not yet rated",
      status: "WARNING" as const,
      fca: "No" as const,
      complaints: "Medium" as const,
      verdict: "Not enough public data to rate yet.",
      color: "red" as const,
    };

    expect(
      extractUiMeta(card, [
        {
          output: {
            uiMeta: {
              verificationKind: "propfirm",
              verificationSourceLabel: "DEVELOPING — MONITOR",
              propFirm: {
                notRated: true,
                trustpilotRating: 4.9,
                trustpilotCount: 5330,
                trustpilotDate: "2026-07-08",
                confirmedFacts: [{ text: "Premium accounts are being refunded.", sourceUrl: "https://example.com/notice" }],
                unconfirmedClaims: ["Payout denial is unconfirmed."],
              },
            },
          },
        },
      ]),
    ).toMatchObject({
      verificationKind: "propfirm",
      propFirm: {
        trustpilotRating: 4.9,
        trustpilotCount: 5330,
        confirmedFacts: [{ text: "Premium accounts are being refunded." }],
      },
    });
  });
});
