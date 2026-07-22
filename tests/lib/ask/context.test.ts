import { describe, expect, it } from "vitest";

import { extractUiMeta } from "@/lib/ask/service/context";

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
