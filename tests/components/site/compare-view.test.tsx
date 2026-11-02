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

const PROP_FIRMS = [entity("ftmo", "Verified", 100, "propfirm"), entity("risky", "High risk", 25, "propfirm"), entity("closed", "Not active", null, "propfirm")];

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
  it("ranks brokers by the visitor's country score and leaves out Not available, Under review and Not active", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: {} }));
    expect(html).toContain("3 brokers");
    expect(html).toContain("Showing results for");
    for (const hidden of ["EXNESS", "REVIEW", "GONE"]) expect(html).not.toContain(`>${hidden}<`);
    // GB: top 93, mid 60, offshore drops to its country score 40.
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
    expect(html).not.toContain(">CLOSED<");
  });

  it("lists every trader (guru register) and links each row to /verify/traders/[slug]", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "guru", searchParams: {} }));
    expect(html).toContain(`${GURUS.length} traders`);
    for (const g of GURUS) {
      expect(html).toContain(g.name);
      expect(html).toContain(`href="/verify/traders/${g.slug}"`);
    }
  });
});
