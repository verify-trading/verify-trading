import { describe, expect, it } from "vitest";

import {
  buildInsightCardFromLooseCard,
  parseAskCardCandidate,
  parseSubmittedAskCardJson,
} from "@/lib/ask/service/card-output";

describe("ask card output parsing", () => {
  it("parses a card_json envelope into an ask card", () => {
    const card = {
      type: "insight",
      headline: "Revenge Trading",
      body: "Losses can turn one mistake into a sequence.",
      verdict: "Pause after the first rule break.",
    };

    expect(parseAskCardCandidate({ card_json: JSON.stringify(card) })).toEqual(card);
  });

  it("repairs briefing cards that omit event and direction", () => {
    expect(
      parseAskCardCandidate({
        type: "briefing",
        asset: "GOLD",
        price: "2340.20",
        change: "-0.42%",
        level1: "2350 resistance",
        level2: "2328 support",
        verdict: "Gold is softer while dollar strength holds.",
      }),
    ).toEqual({
      type: "briefing",
      asset: "GOLD",
      price: "2340.20",
      change: "-0.42%",
      direction: "down",
      level1: "2350 resistance",
      level2: "2328 support",
      event: null,
      verdict: "Gold is softer while dollar strength holds.",
    });
  });

  it("builds an insight fallback from a loose card", () => {
    expect(
      buildInsightCardFromLooseCard({
        type: "briefing",
        asset: "GOLD",
        level1: "2350 resistance",
        level2: "2328 support",
      }),
    ).toEqual({
      type: "insight",
      headline: "GOLD",
      body: "Key area one: 2350 resistance. Key area two: 2328 support.",
      verdict: "Ask for the asset, levels, setup, broker, or calculation you want checked.",
    });
  });

  it("throws clear errors for submitted invalid JSON and invalid card schema", () => {
    expect(() => parseSubmittedAskCardJson("{")).toThrow(
      "submit_ask_card: card_json must be valid JSON.",
    );

    expect(() =>
      parseSubmittedAskCardJson(
        JSON.stringify({
          type: "insight",
          headline: "Risk Check",
          body: "Wait for confirmation.",
        }),
      ),
    ).toThrow(/submit_ask_card:/);
  });
});
