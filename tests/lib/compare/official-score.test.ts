import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { publicationCheck } from "@/lib/compare/bts-l2";
import { withOfficialScores, type PublicEntity } from "@/lib/compare/entities";

const check = (over: Partial<Parameters<typeof publicationCheck>[0]> = {}) => ({
  kind: "broker" as const,
  finalScore: 74,
  confidence: 93,
  identity: { confirmed: true, legal_entity: "FxPro UK Ltd", official_website: "fxpro.com", note: "" },
  sources: [{ id: "s1", url: "https://register.fca.org.uk/x", type: "official_register" as const, title: "" }, { id: "s2", url: "https://cysec.gov.cy/x", type: "official_register" as const, title: "" }],
  ...over,
});

describe("official score", () => {
  it("publishes solid evidence and holds big moves or thin evidence for review", () => {
    expect(publicationCheck(check(), 70, 100)).toEqual({ status: "published", reason: null });
    expect(publicationCheck(check(), null, 90)).toEqual({ status: "published", reason: null });
    expect(publicationCheck(check(), 60, null).reason).toBe("Moves +14 from the published 60");
    expect(publicationCheck(check({ finalScore: 49 }), null, 100).reason).toBe("First score 49 is 51 points from the baseline 100");
    expect(publicationCheck(check({ confidence: 60 }), null, null).status).toBe("review");
    expect(publicationCheck(check({ sources: [] }), null, null).reason).toBe("0 primary sources, needs 2");
    expect(publicationCheck(check({ finalScore: null }), null, null).status).toBe("review");
  });

  it("replaces the baseline with the global official score and marks the rest as baseline", () => {
    const firm = (id: string, score: number | null): PublicEntity =>
      ({ slug: id, name: id, type: "broker", verdict: "Verified", score, bts: { entityId: id } } as unknown as PublicEntity);
    const [a, b, c] = withOfficialScores([firm("A", 100), firm("B", 88), firm("C", null)], {
      "A|XX": { score: 74, verdict: "Generally positive", checkedAt: "2026-11-04T10:00:00Z" },
      "B|GB": { score: 74, verdict: "Generally positive", checkedAt: "2026-11-04T10:00:00Z" },
    });
    expect(a).toMatchObject({ score: 74, verdict: "Generally positive", scoreBasis: "official" });
    expect(b).toMatchObject({ score: 88, scoreBasis: "baseline" });
    expect(c.scoreBasis).toBeUndefined();
  });
});
