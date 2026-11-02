import { describe, expect, it } from "vitest";

import { entityReviewSchema } from "@/lib/marketing/seo";

describe("entityReviewSchema", () => {
  const base = {
    name: "FxPro",
    path: "/verify/brokers/fxpro",
    description: "Independent broker check for FxPro: verdict Caution.",
    category: "Online broker",
    verdict: "Caution",
    score: 74,
    updatedAt: "2026-09-29",
    regulators: ["FCA", "CySEC"],
    foundingDate: "2006",
    itemType: "FinancialService" as const,
  };

  it("types the reviewed entity by what it is, not as a Product (avoids the Product rich-result error)", () => {
    const s = entityReviewSchema(base);
    expect(s["@type"]).toBe("Review");
    const item = s.itemReviewed as Record<string, unknown>;
    expect(item["@type"]).toBe("FinancialService");
    expect(item["@type"]).not.toContain("Product");
    expect(item.name).toBe("FxPro");
    expect(item.brand).toEqual({ "@type": "Brand", name: "FxPro" });
    expect(item.category).toBe("Online broker");
    expect(item.foundingDate).toBe("2006");
  });

  it("publishes the BTS score as a 0-100 Rating when it exists", () => {
    const s = entityReviewSchema(base);
    expect(s.reviewRating).toEqual({
      "@type": "Rating",
      ratingValue: "74",
      bestRating: "100",
      worstRating: "0",
      alternateName: "Caution",
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
