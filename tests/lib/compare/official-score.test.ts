import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { isDisputed, publicationCheck } from "@/lib/compare/bts-l2";
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

describe("official score", () => {
  it("publishes solid evidence and holds big moves or thin evidence for review", () => {
    const base = (score: number, verdict: string) => ({ score, verdict });
    expect(publicationCheck(check(), 70, base(100, "Verified"))).toEqual({ status: "published", reason: null });
    expect(publicationCheck(check(), null, base(90, "Verified"))).toEqual({ status: "published", reason: null });
    expect(publicationCheck(check(), 60, null).reason).toBe("Score change: moves +14 from the published 60");
    // FxPro: 100 -> 78 stays positive, so it publishes; Leveraged 100 -> 43 flips to high risk and waits.
    expect(publicationCheck(check({ finalScore: 78 }), null, base(100, "Verified")).status).toBe("published");
    expect(publicationCheck(check({ finalScore: 43, verdict: "High risk" }), null, base(100, "Record reviewed")).reason).toBe("Score change: first score 43 (High risk) is 57 points from the baseline 100 (Record reviewed)");
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
