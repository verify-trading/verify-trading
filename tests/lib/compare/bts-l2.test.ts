import { describe, expect, it } from "vitest";

import { scoreAssessment as scoreWithEvidence } from "@/lib/compare/bts-l2";

const retrievedUrls = new Set(["https://www.asfromania.ro/alerts", "https://elitesfunding.com/terms-of-use/"]);
const scoreAssessment = (kind: Parameters<typeof scoreWithEvidence>[0], research: Parameters<typeof scoreWithEvidence>[1]) => scoreWithEvidence(kind, research, retrievedUrls);

const draft = (pillars: Array<[string, number, string[]]>, extra: Partial<Parameters<typeof scoreAssessment>[1]> = {}) => ({
  kind: "propfirm" as const,
  identity: { confirmed: true, legal_entity: "MASTERLABS LIMITED", official_website: "https://elitesfunding.com", note: "" },
  sources: [
    { id: "s1", url: "https://www.asfromania.ro/alerts", type: "regulator_notice" as const, title: "ASF alert" },
    { id: "s2", url: "https://elitesfunding.com/terms-of-use/", type: "company_terms" as const, title: "Terms" },
    { id: "s9", url: "not a url", type: "news" as const, title: "bad" },
  ],
  pillars: pillars.map(([pillar, awarded, source_ids]) => ({ pillar, awarded, reason: `r ([site](https://x.y?utm_source=openai))`, source_ids })),
  findings: [
    { authority: "ASF", legal_entity: "MASTERLABS LIMITED", jurisdiction: "RO", date: "2024-10-17", finding: "Not authorised in Romania", outcome: "", adverse: true, source_id: "s1" },
    { authority: "?", legal_entity: "", jurisdiction: "", date: "", finding: "invented", outcome: "", adverse: true, source_id: "s7" },
  ],
  country_fit: "UNVERIFIED" as const,
  strengths: [],
  risks: [],
  summary: "s",
  regulators: [],
  conditions: { platforms: "MT5", gold_spread: "not found", commission: "none", min_deposit: "$100", scalping: "allowed" },
  answer: "a",
  concern: "c",
  recommendation: "r",
  ...extra,
});

describe("Layer 2 scoring (code decides the number)", () => {
  it("totals validated points, clamps, halves unsourced pillars and derives the verdict", () => {
    const a = scoreAssessment("propfirm", draft([["identity", 25, ["s2"]], ["payout", 20, []], ["terms", 11, ["s2", "s9"]], ["outcomes", 4, ["s7"]], ["conduct", 6, ["s1"]]]));
    // identity clamped 25→20; payout unsourced 20→10; outcomes cites only a missing source 4→4 (≤10); bad URL dropped.
    expect(a.pillars.map((p) => [p.key, p.awarded, p.sourced])).toEqual([["identity", 20, true], ["payout", 10, false], ["terms", 11, true], ["outcomes", 4, false], ["conduct", 6, true]]);
    expect(a.finalScore).toBe(51);
    expect(a.verdict).toBe("Caution");
    expect(a.pillars[0].reason).toBe("r");
  });

  it("measures confidence by source reliability, not field completeness", () => {
    const a = scoreAssessment("propfirm", draft([["identity", 10, ["s2"]], ["payout", 10, []], ["terms", 10, ["s2"]], ["outcomes", 10, []], ["conduct", 10, ["s1"]]]));
    expect(a.confidence).toBe(Math.round(20 * 0.7 + 20 * 0.7 + 20 * 1));
  });

  it("keeps only findings with a real source", () => {
    const a = scoreAssessment("propfirm", draft([["conduct", 6, ["s1"]], ["identity", 15, ["s2"]]]));
    expect(a.findings.map((f) => f.authority)).toEqual(["ASF"]);
    expect(a.sources.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("rejects well-formed URLs that were never retrieved", () => {
    const a = scoreWithEvidence("propfirm", draft([["identity", 20, ["s2"]], ["conduct", 20, ["s1"]]]), new Set());
    expect(a.sources).toEqual([]);
    expect(a.findings).toEqual([]);
    expect(a.finalScore).toBeNull();
    expect(a.confidence).toBe(0);
  });

  it("publishes no number when identity is unconfirmed or evidence is too thin", () => {
    const unconfirmed = draft([["identity", 20, ["s2"]], ["conduct", 20, ["s1"]]], { identity: { confirmed: false, legal_entity: "", official_website: "", note: "" } });
    expect(scoreAssessment("propfirm", unconfirmed)).toMatchObject({ finalScore: null, verdict: "Score unavailable" });
    expect(scoreAssessment("broker", draft([["regulation", 40, []]]))).toMatchObject({ finalScore: null, verdict: "Score unavailable", confidence: 0 });
  });
});
