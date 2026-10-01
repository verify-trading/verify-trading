import { describe, expect, it } from "vitest";

import { toPublicEntity, parseRegulatorRefs, type PublicEntity } from "@/lib/compare/entities";
import { entityFaqs, isIndexable, isIndexedPair, pairKey, pickAlternatives, vsPairs } from "@/lib/compare/insights";
import { findRegulator, getRegulator } from "@/lib/compare/regulators";

const broker = (slug: string, over: Record<string, unknown> = {}) =>
  toPublicEntity({ slug, name: slug.toUpperCase(), entity_type: "broker", status: "legitimate", final_tier: "Tier 1", founder_verified: true, regulators_listed: "FCA (United Kingdom), CySEC (Cyprus)", updated_at: "2026-06-18T12:00:00Z", ...over })!;

describe("regulator mapping", () => {
  it("disambiguates codes by country", () => {
    expect(findRegulator("FSC", "Mauritius")?.slug).toBe("fsc-mauritius");
    expect(findRegulator("FSC", "The British Virgin Islands")?.slug).toBe("fsc-bvi");
    expect(findRegulator("FSA", "Seychelles")?.slug).toBe("fsa-seychelles");
    expect(findRegulator("FSC", null)).toBeNull();
    expect(getRegulator("nope")).toBeNull();
  });
  it("parses refs with country and adds FCA when register-confirmed", () => {
    expect(parseRegulatorRefs("FSA (Seychelles), FSC (Mauritius)").map((r) => r.slug)).toEqual(["fsa-seychelles", "fsc-mauritius"]);
    expect(parseRegulatorRefs(null, true)[0]).toMatchObject({ code: "FCA", slug: "fca" });
    expect(parseRegulatorRefs("NONE (Requires Additional Regulation)")).toEqual([]);
  });
});

describe("isIndexable (thin-page rule)", () => {
  it("indexes rated brokers with a regulator", () => expect(isIndexable(broker("a"))).toBe(true));
  it("noindexes brokers with no regulator, no FCA data", () => expect(isIndexable(broker("b", { regulators_listed: null, final_tier: "Unregulated", founder_verified: false }))).toBe(false));
  it("noindexes unrated and provisional brokers", () => {
    expect(isIndexable(broker("c", { final_tier: null, trust_score: null }))).toBe(false);
  });
  it("noindexes unscored prop firms, indexes scored and closed ones", () => {
    const p = (o: Record<string, unknown>) => toPublicEntity({ slug: "p", name: "P", entity_type: "propfirm", ...o })!;
    expect(isIndexable(p({ trust_score: null, firm_status: "Operating" }))).toBe(false);
    expect(isIndexable(p({ trust_score: 7.5, firm_status: "Operating" }))).toBe(true);
    expect(isIndexable(p({ trust_score: 7.5, firm_status: "Closed down" }))).toBe(true);
  });
});

describe("alternatives and vs pairs", () => {
  const all: PublicEntity[] = [
    broker("me", { final_tier: "Tier 3", founder_verified: false }),
    broker("hi", { final_tier: "Tier 1" }),
    broker("other", { final_tier: "Tier 1", regulators_listed: "ASIC (Australia)" }),
    broker("warn", { fca_warning: true }),
    broker("low", { final_tier: "Tier 3", founder_verified: false }),
  ];
  it("picks same-regulator, equal-or-better, non-warned brokers", () => {
    const alts = pickAlternatives(all[0], all).map((e) => e.slug);
    expect(alts).toContain("hi");
    expect(alts).not.toContain("warn");
    expect(alts).not.toContain("me");
    expect(alts).not.toContain("other");
  });
  it("bounds and canonicalises vs pairs", () => {
    const pairs = vsPairs(all);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs) expect(a.slug < b.slug).toBe(true);
    expect(pairKey("z", "a")).toEqual(["a", "z"]);
    expect(isIndexedPair(all, "hi", "me")).toBe(true);
    expect(isIndexedPair(all, "hi", "other")).toBe(false);
  });
});

describe("entityFaqs", () => {
  it("answers from the record only", () => {
    const faqs = entityFaqs(broker("x", { fca_registered: true, fca_reference: "999" }));
    expect(faqs.find((f) => f.q.includes("FCA"))?.a).toContain("999");
    expect(faqs.length).toBeGreaterThanOrEqual(4);
  });
});
