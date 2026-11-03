import { describe, expect, it } from "vitest";

import { toPublicEntity, parseRegulatorRefs, verdictTone, type PublicEntity } from "@/lib/compare/entities";
import { entityFaqs, entityPath, isIndexable, isIndexedVsPair, isSeoWorthy, pairKey, parseVsPair, pickAlternatives, propVsPairs, VERDICT_RANK, vsPairs, vsPath } from "@/lib/compare/insights";
import { findRegulator, getRegulator } from "@/lib/compare/regulators";

/** A BTS engine row as the join returns it. */
const bts = (verdict: string, score: number | null, licences = "FCA:1|CYSEC:2") => ({
  entity_id: `BTS-${verdict}-${score}-${licences}`,
  verdict,
  global_score: score,
  details: { active_verified_licences: licences },
  pillars: {},
  research_date: "2026-10-30",
});
const broker = (slug: string, over: Record<string, unknown> = {}) =>
  toPublicEntity({ slug, name: slug.toUpperCase(), entity_type: "broker", updated_at: "2026-06-18T12:00:00Z", bts: bts("VERIFIED", 90), ...over })!;
const prop = (slug: string, over: Record<string, unknown> = {}) =>
  toPublicEntity({ slug, name: slug.toUpperCase(), entity_type: "propfirm", ...over })!;

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
  it("indexes records with an engine score", () => {
    expect(isIndexable(broker("a"))).toBe(true);
    expect(isIndexable(prop("p", { bts: bts("CAUTION", 60, "") }))).toBe(true);
  });
  it("noindexes records without a score: not scored, Under review or Not active", () => {
    expect(isIndexable(broker("c", { bts: null }))).toBe(false);
    expect(isIndexable(broker("d", { bts: bts("UNDER REVIEW", null) }))).toBe(false);
    expect(isIndexable(prop("p", { bts: bts("NOT ACTIVE", 50, "") }))).toBe(false);
  });
});

describe("isSeoWorthy (sitemap + robots gate)", () => {
  it("indexes every prop firm, rated or not — brand-query opportunity outweighs thin-content risk", () => {
    for (const score of [90, 75, 55, 35, 15]) expect(isSeoWorthy(prop("p", { bts: bts("CAUTION", score, "") }))).toBe(true);
    expect(isSeoWorthy(prop("p"))).toBe(true);
  });
  it("indexes every broker, rated or not — same brand-query reasoning as prop firms", () => {
    expect(isSeoWorthy(broker("st"))).toBe(true);
    expect(isSeoWorthy(broker("warn", { fca_warning: true }))).toBe(true);
    expect(isSeoWorthy(broker("none", { bts: null }))).toBe(true);
  });
});

describe("alternatives and vs pairs", () => {
  const all: PublicEntity[] = [
    broker("me", { bts: bts("CAUTION", 40) }),
    broker("hi"),
    broker("other", { bts: bts("VERIFIED", 95, "ASIC:1") }),
    broker("warn", { fca_warning: true }),
    broker("low", { bts: bts("CAUTION", 30) }),
    broker("gone", { bts: bts("NOT ACTIVE", null) }),
  ];
  it("picks same-regulator, equal-or-better, non-warned brokers", () => {
    const alts = pickAlternatives(all[0], all).map((e) => e.slug);
    expect(alts).toContain("hi");
    expect(alts).not.toContain("warn");
    expect(alts).not.toContain("me");
    expect(alts).not.toContain("other");
    expect(alts).not.toContain("gone");
  });
  it("produces canonical, deduped, bounded broker vs pairs", () => {
    const pairs = vsPairs(all);
    expect(pairs.length).toBeGreaterThan(0);
    // Every pair is stored in canonical (alphabetical by slug) order.
    for (const [a, b] of pairs) expect(a.slug < b.slug).toBe(true);
    // No duplicates across orderings.
    const keys = pairs.map(([a, b]) => `${a.slug}|${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    // "warn" (FCA warning) is never paired.
    expect(pairs.some(([a, b]) => a.slug === "warn" || b.slug === "warn")).toBe(false);
    // isIndexedVsPair agrees with membership, in either requested order.
    const [first] = pairs;
    expect(isIndexedVsPair("broker", all, first[0].slug, first[1].slug)).toBe(true);
    expect(isIndexedVsPair("broker", all, first[1].slug, first[0].slug)).toBe(true);
    expect(isIndexedVsPair("broker", all, "hi", "warn")).toBe(false);
  });

  it("pairKey sorts, vsPath builds the canonical /compare URL, parseVsPair round-trips", () => {
    expect(pairKey("z", "a")).toEqual(["a", "z"]);
    expect(vsPath("broker", "zeta", "alpha")).toBe("/compare/brokers/alpha-vs-zeta");
    expect(vsPath("propfirm", "topstep", "ftmo")).toBe("/compare/prop-firms/ftmo-vs-topstep");
    expect(parseVsPair("alpha-vs-zeta")).toEqual(["alpha", "zeta"]);
    expect(parseVsPair("same-vs-same")).toBeNull(); // self-pair rejected
    expect(parseVsPair("no-delimiter")).toBeNull();
    expect(parseVsPair("-vs-b")).toBeNull();
  });

  it("pairs prop firms by score, excluding closed and unscored", () => {
    const firms = [
      prop("ftmo", { bts: bts("VERIFIED", 100, "") }),
      prop("topstep", { bts: bts("VERIFIED", 85, "") }),
      prop("apex", { bts: bts("CAUTION", 72, "") }),
      prop("closed", { bts: bts("NOT ACTIVE", 90, "") }),
      prop("unrated"),
    ];
    const pairs = propVsPairs(firms);
    expect(pairs.length).toBe(3); // ftmo, topstep, apex → 3 pairs
    for (const [a, b] of pairs) expect(a.slug < b.slug).toBe(true);
    expect(pairs.some(([a, b]) => a.slug === "closed" || b.slug === "closed")).toBe(false);
    expect(pairs.some(([a, b]) => a.slug === "unrated" || b.slug === "unrated")).toBe(false);
    expect(isIndexedVsPair("propfirm", firms, "topstep", "ftmo")).toBe(true);
  });
});

describe("entityFaqs", () => {
  it("answers from the record only", () => {
    const faqs = entityFaqs(broker("x", { bts: bts("VERIFIED", 90, "FCA:999") }));
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

  it("maps verdicts via the guru resolver and routes to /compare/traders", () => {
    const g = guru("steady");
    expect(g.type).toBe("guru");
    expect(g.verdict).toBe("Verified");
    expect(g.score).toBeNull();
    expect(entityPath(g)).toBe("/compare/traders/steady");
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
