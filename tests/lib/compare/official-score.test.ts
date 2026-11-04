import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { isDisputed, publicationCheck, takeMatches } from "@/lib/compare/bts-l2";
import { withOfficialScores, type PublicEntity } from "@/lib/compare/entities";

const check = (over: Partial<Parameters<typeof publicationCheck>[0]> = {}) => ({
  kind: "broker" as const,
  finalScore: 74,
  verdict: "Generally positive" as const,
  confidence: 93,
  identity: { confirmed: true, legal_entity: "FxPro UK Ltd", official_website: "fxpro.com", note: "" },
  sources: [{ id: "s1", url: "https://register.fca.org.uk/x", type: "official_register" as const, title: "" }, { id: "s2", url: "https://cysec.gov.cy/x", type: "official_register" as const, title: "" }],
  ...over,
});

const base = (score: number, verdict: string) => ({ score, verdict });

describe("official score", () => {
  it("publishes solid evidence and holds big moves or thin evidence for review", () => {
    // A re-check close to the official score confirms it (no flapping); a bigger move waits for a person.
    expect(publicationCheck(check(), base(70, "Generally positive"), base(100, "Verified"))).toEqual({ status: "confirmed", reason: "Recheck: 74 confirms the published 70" });
    expect(publicationCheck(check({ finalScore: 76 }), base(70, "Generally positive"), null).reason).toBe("Score change: re-check gives 76 (Generally positive) against the published 70 (Generally positive)");
    // 49/50 boundary both ways: crossing into or out of High risk is always held.
    expect(publicationCheck(check({ finalScore: 49, verdict: "High risk" }), base(50, "Caution"), null).reason).toMatch(/^Score change: verdict moves from Caution to High risk/);
    expect(publicationCheck(check({ finalScore: 50, verdict: "Caution" }), base(49, "High risk"), null).reason).toMatch(/^Score change: verdict moves from High risk to Caution/);
    // The same page cited twice is one primary source.
    expect(publicationCheck(check({ sources: [{ id: "s1", url: "https://register.fca.org.uk/x", type: "official_register", title: "" }, { id: "s2", url: "https://register.fca.org.uk/x/", type: "official_register", title: "" }] }), null, null).reason).toBe("Evidence: 1 primary source, needs 2");
    expect(publicationCheck(check(), null, base(90, "Verified"))).toEqual({ status: "published", reason: null });
    expect(publicationCheck(check(), base(60, "Caution"), null).reason).toBe("Score change: re-check gives 74 (Generally positive) against the published 60 (Caution)");
    // Into or out of High risk always waits for a person (IC Markets Global: 59 Caution -> 41 High risk).
    expect(publicationCheck(check({ finalScore: 41, verdict: "High risk" }), null, base(59, "Caution")).reason).toBe("Score change: verdict moves from Caution to High risk (41)");
    expect(publicationCheck(check({ finalScore: 45, verdict: "High risk" }), base(52, "Caution"), null).status).toBe("review");
    expect(publicationCheck(check({ finalScore: 38, verdict: "High risk" }), base(41, "High risk"), null).status).toBe("confirmed");
    // FxPro: 100 -> 78 stays positive, so it publishes; Leveraged 100 -> 43 flips to high risk and waits.
    expect(publicationCheck(check({ finalScore: 78 }), null, base(100, "Verified")).status).toBe("published");
    expect(publicationCheck(check({ finalScore: 43, verdict: "High risk" }), null, base(100, "Record reviewed")).reason).toBe("Score change: verdict moves from Record reviewed to High risk (43)");
    expect(publicationCheck(check({ finalScore: 62, verdict: "Caution" }), null, base(88, "Verified")).status).toBe("review");
    // Same verdict on both scales (The5ers 74 -> 52, Exness 34 -> 60, both Caution): publish.
    expect(publicationCheck(check({ finalScore: 52, verdict: "Caution" }), null, base(74, "Caution")).status).toBe("published");
    expect(publicationCheck(check({ finalScore: 60, verdict: "Caution" }), null, base(34, "Caution")).status).toBe("published");
    expect(publicationCheck(check({ confidence: 60 }), null, null).reason).toMatch(/^Evidence:/);
    expect(publicationCheck(check({ sources: [] }), null, null).reason).toBe("Evidence: 0 primary sources, needs 2");
    expect(publicationCheck(check({ finalScore: null }), null, null).status).toBe("review");
    expect(isDisputed({ status: "review", reviewReason: "Score change: moves -20 from the published 80" })).toBe(true);
    expect(isDisputed({ status: "review", reviewReason: "Evidence: 1 primary source, needs 2" })).toBe(false);
  });

  it("accepts a quick take only when its view fits the score", () => {
    expect(takeMatches("I'd avoid IC Markets Global: the FCA has warned about it.", "avoid")).toBe(true);
    expect(takeMatches("I'd be careful with IC Markets Global because protections depend on the company.", "avoid")).toBe(false);
    expect(takeMatches("I'd be careful with Tickmill until I know which entity holds my account.", "comfortable")).toBe(false);
    expect(takeMatches("I'd be comfortable with Tickmill as long as I checked which company holds my account.", "comfortable")).toBe(true);
    expect(takeMatches("I'd be careful with XM: protections depend on the company.", "careful")).toBe(true);
    expect(takeMatches("", "careful")).toBe(false);
  });

  it("replaces the baseline with the global official score and marks the rest as baseline", () => {
    const firm = (id: string, score: number | null): PublicEntity =>
      ({ slug: id, name: id, type: "broker", verdict: "Verified", score, bts: { entityId: id } } as unknown as PublicEntity);
    const [a, b, c, d] = withOfficialScores([firm("A", 100), firm("B", 88), firm("C", null), firm("D", 100)], {
      "A|XX": { score: 74, verdict: "Generally positive", checkedAt: "2026-11-04T10:00:00Z" },
      "B|GB": { score: 74, verdict: "Generally positive", checkedAt: "2026-11-04T10:00:00Z" },
      "D|XX": { score: null, verdict: "Under review", checkedAt: "2026-11-04T10:00:00Z" },
    });
    expect(d).toMatchObject({ score: null, verdict: "Under review", scoreBasis: null });
    expect(a).toMatchObject({ score: 74, verdict: "Generally positive", scoreBasis: "official" });
    expect(b).toMatchObject({ score: 88, scoreBasis: "baseline" });
    expect(c.scoreBasis).toBeUndefined();
  });
});
