import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PublicEntity } from "@/lib/compare/entities";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const entity = (slug: string, verdict: PublicEntity["verdict"], score: number | null, type: PublicEntity["type"] = "broker"): PublicEntity => ({
  slug,
  name: slug.toUpperCase(),
  type,
  verdict,
  score,
  bts: { entityId: `BTS-${slug}`, confidence: 80, reason: null, cap: null, pillars: [], cloneAlert: false, researchDate: "2026-10-30", licences: [{ code: "FCA", number: "1" }] },
  closed: verdict === "Not active",
  reviewed: false,
  regulators: ["FCA"],
  regulatorDetails: [],
  fcaRegistered: true,
  fcaReference: null,
  fcaWarning: false,
  yearFounded: null,
  updatedAt: "2026-10-30",
  // As withOfficialScores leaves a scored firm that has no official score.
  ...(score === null ? {} : { scoreBasis: "baseline" as const }),
});

const BROKERS = [
  entity("mid", "Caution", 60),
  entity("top", "Verified", 93),
  entity("offshore", "Verified", 88), // no local licence in GB: the country row says Caution 40
  entity("exness", "Caution", 34), // not available in GB
  entity("review", "Under review", null),
  entity("gone", "Not active", null),
];

// What the engine's country table says for a GB visitor.
const GB_ROWS = {
  "BTS-offshore": { country: "GB", fit: "NO LOCAL LICENCE VERIFIED", score: 40, verdict: "CAUTION", licences: null, note: null },
  "BTS-exness": { country: "GB", fit: "NOT AVAILABLE", score: 34, verdict: "NOT AVAILABLE IN YOUR COUNTRY", licences: null, note: null },
};

vi.mock("@/lib/compare/bts-data", () => ({
  getRequestCountry: vi.fn(async () => "GB"),
  getCountryRows: vi.fn(async () => GB_ROWS),
}));

const PROP_FIRMS = [entity("ftmo", "Record reviewed", 100, "propfirm"), entity("risky", "High risk", 25, "propfirm"), entity("closed", "Not active", null, "propfirm")];

const guru = (slug: string, verdict: PublicEntity["verdict"]): PublicEntity => ({
  ...entity(slug, verdict, null, "guru"),
  bts: null,
  regulators: [],
  fcaRegistered: false,
  publishable: true,
  reviewed: true,
  citationUrl: verdict === "Caution" ? "https://www.sec.gov/example" : null,
  bioSummary: null,
});

const GURUS = [guru("alice-verified", "Verified"), guru("bob-unverified", "Unverified"), guru("carol-caution", "Caution")];

vi.mock("@/lib/compare/entities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/compare/entities")>()),
  getPublicEntities: vi.fn(async (type: string) => (type === "broker" ? BROKERS : type === "propfirm" ? PROP_FIRMS : GURUS)),
}));

const { CompareView } = await import("@/components/marketing/compare-view");

const order = (html: string, names: string[]) => names.map((n) => html.indexOf(`>${n}<`));

describe("Compare directory (BTS v2)", () => {
  it("shows a GB visitor the scores Ask shows: country baselines applied, Not available left out, unlisted firms in the A–Z directory only", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: {} }));
    // exness is Not available in GB, so it leaves the list (a name search still finds it).
    expect(html).toContain("3 brokers");
    expect(html).toContain("Showing results for");
    // Unlisted records appear exactly once: as a plain link in the A–Z directory, never as a ranked row.
    expect(html).toContain("A to Z");
    for (const hidden of ["REVIEW", "GONE", "EXNESS"]) expect((html.match(new RegExp(`>${hidden}<`, "g")) ?? []).length).toBe(1);
    // offshore has no GB licence: its 88 becomes the GB baseline 40, below mid's 60.
    const [top, mid, offshore] = order(html, ["TOP", "MID", "OFFSHORE"]);
    expect(top).toBeLessThan(mid);
    expect(mid).toBeLessThan(offshore);
  });

  it("still finds an unlisted firm by name search", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: { q: "exness" } }));
    expect(html).toContain(">EXNESS<");
  });

  it("lists prop firms by score without the Not active ones", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "propfirm", searchParams: {} }));
    expect(html).toContain("2 prop firms");
    expect(html).toContain("Record reviewed");
    expect(html).not.toMatch(/>Verified</);
    // Not active firms stay out of the ranked table but keep their one A–Z directory link.
    expect((html.match(/>CLOSED</g) ?? []).length).toBe(1);
  });

  it("lists every trader (guru register) and links each row to /compare/traders/[slug]", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "guru", searchParams: {} }));
    expect(html).toContain(`${GURUS.length} traders`);
    for (const g of GURUS) {
      expect(html).toContain(g.name);
      expect(html).toContain(`href="/compare/traders/${g.slug}"`);
    }
  });
});
