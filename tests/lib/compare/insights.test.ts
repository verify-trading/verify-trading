import { describe, expect, it } from "vitest";

import { toPublicEntity, parseRegulatorRefs, verdictTone, type PublicEntity } from "@/lib/compare/entities";
import { entityFaqs, entityPath, isIndexable, isIndexedPair, isSeoWorthy, pairKey, pickAlternatives, VERDICT_RANK, vsPairs } from "@/lib/compare/insights";
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

describe("isSeoWorthy (sitemap + robots gate)", () => {
  const prop = (o: Record<string, unknown>) => toPublicEntity({ slug: "p", name: "P", entity_type: "propfirm", firm_status: "Operating", ...o })!;

  it("indexes every prop firm, rated or not — brand-query opportunity outweighs thin-content risk", () => {
    for (const score of [9.0, 7.5, 5.5, 3.5, 1.5]) {
      expect(isSeoWorthy(prop({ trust_score: score }))).toBe(true);
    }
    // "Not yet rated" prop firms also index (brand-name queries).
    expect(isSeoWorthy(prop({ trust_score: null }))).toBe(true);
  });
  it("indexes every broker, rated or not — same brand-query reasoning as prop firms", () => {
    expect(isSeoWorthy(broker("st", { final_tier: "Tier 1", founder_verified: true }))).toBe(true);
    expect(isSeoWorthy(broker("t", { final_tier: "Tier 2", founder_verified: true }))).toBe(true);
    expect(isSeoWorthy(broker("warn", { fca_warning: true }))).toBe(true);
    expect(isSeoWorthy(broker("none", {}))).toBe(true);
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
  it("produces no indexed vs pairs (VS pages removed for SEO)", () => {
    expect(vsPairs(all)).toEqual([]);
    expect(pairKey("z", "a")).toEqual(["a", "z"]);
    expect(isIndexedPair(all, "hi", "me")).toBe(false);
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

describe("guru register", () => {
  const guru = (slug: string, over: Record<string, unknown> = {}) =>
    toPublicEntity({
      slug,
      name: slug.toUpperCase(),
      entity_type: "guru",
      guru_tier: "Verified",
      verified_track_record: "Yes (confirmed)",
      research_status: "researched",
      identity_confirmed: true,
      updated_at: "2026-10-01T00:00:00Z",
      ...over,
    })!;

  it("maps verdicts via the guru resolver and routes to /verify/traders", () => {
    const g = guru("steady");
    expect(g.type).toBe("guru");
    expect(g.verdict).toBe("Verified");
    expect(g.score).toBeNull();
    expect(entityPath(g)).toBe("/verify/traders/steady");
  });

  it("drops a Caution to Unverified when the citation URL is missing or invalid", () => {
    const bad = guru("bad", { guru_tier: "Caution", regulator_flag_source: "not a url" });
    expect(bad.verdict).toBe("Unverified");
    expect(bad.citationUrl).toBeNull();
    const ok = guru("ok", { guru_tier: "Caution", regulator_flag_source: "https://www.sec.gov/litreleases/example.htm" });
    expect(ok.verdict).toBe("Caution");
    expect(ok.citationUrl).toBe("https://www.sec.gov/litreleases/example.htm");
  });

  it("exposes publishable as a loader guard — unpublishable rows still map but will be filtered by loadEntities", () => {
    const hidden = guru("hidden", { identity_confirmed: false });
    expect(hidden.publishable).toBe(false);
    const live = guru("live");
    expect(live.publishable).toBe(true);
  });

  it("indexes every publishable guru (brand-query reasoning)", () => {
    expect(isSeoWorthy(guru("v"))).toBe(true);
    expect(isSeoWorthy(guru("u", { guru_tier: "Unverified", verified_track_record: null }))).toBe(true);
    expect(isIndexable(guru("v"))).toBe(true);
  });

  it("gives each guru tier its own tone and rank", () => {
    expect(verdictTone("Verified")).toBe("green");
    expect(verdictTone("Unverified")).toBe("slate");
    expect(verdictTone("Caution")).toBe("amber");
    expect(VERDICT_RANK.Verified).toBeLessThan(VERDICT_RANK.Unverified);
    expect(VERDICT_RANK.Unverified).toBeLessThan(VERDICT_RANK.Caution);
  });

  it("has no alternatives (people are not comparable products)", () => {
    expect(pickAlternatives(guru("g"), [guru("h"), guru("i")])).toEqual([]);
  });

  it("writes FAQs that lead with the tier meaning, not a numeric score", () => {
    const faqs = entityFaqs(guru("alice", { name: "Alice" }));
    expect(faqs.find((f) => f.q.toLowerCase().includes("score"))?.a).toContain("never");
    expect(faqs.length).toBeGreaterThanOrEqual(4);
  });
});
