import { describe, expect, it } from "vitest";

import { entityReviewSchema } from "@/lib/marketing/seo";

describe("entityReviewSchema", () => {
  const base = {
    name: "FxPro",
    path: "/compare/brokers/fxpro",
    description: "Independent broker check for FxPro: verdict Trusted.",
    category: "Online broker",
    verdict: "Trusted",
    score: 7.9,
    updatedAt: "2026-09-29",
    regulators: ["FCA", "CySEC"],
    foundingDate: "2006",
    itemType: "FinancialService" as const,
  };

  it("models the broker as a Product so the review check passes", () => {
    const s = entityReviewSchema(base);
    expect(s["@type"]).toBe("Review");
    const item = s.itemReviewed as Record<string, unknown>;
    expect(item["@type"]).toEqual(["Product", "FinancialService"]);
    expect(item.name).toBe("FxPro");
    expect(item.brand).toEqual({ "@type": "Brand", name: "FxPro" });
    expect(item.category).toBe("Online broker");
    expect(item.foundingDate).toBe("2006");
  });

  it("publishes the score as a 0-10 Rating when it exists", () => {
    const s = entityReviewSchema(base);
    expect(s.reviewRating).toEqual({
      "@type": "Rating",
      ratingValue: "7.9",
      bestRating: "10",
      worstRating: "0",
      alternateName: "Trusted",
    });
  });

  it("omits reviewRating for unrated records rather than fabricating a score", () => {
    const s = entityReviewSchema({ ...base, score: null });
    expect(s.reviewRating).toBeUndefined();
  });

  it("names verify.trading as both author and publisher", () => {
    const s = entityReviewSchema(base);
    expect(s.author).toMatchObject({ "@type": "Organization" });
    expect(s.publisher).toMatchObject({ "@type": "Organization" });
  });
});
