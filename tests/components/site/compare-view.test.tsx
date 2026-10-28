import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PublicEntity } from "@/lib/compare/entities";

const entity = (slug: string, verdict: PublicEntity["verdict"], type: PublicEntity["type"] = "broker"): PublicEntity => ({
  slug,
  name: slug.toUpperCase(),
  type,
  verdict,
  score: verdict === "Not yet rated" ? null : 8,
  provisional: false,
  closed: false,
  developing: false,
  reviewed: false,
  regulators: ["FCA"],
  regulatorDetails: [],
  fcaRegistered: true,
  fcaReference: null,
  fcaWarning: false,
  yearFounded: null,
  updatedAt: "2026-06-18T12:00:00Z",
});

// 1 strongly trusted broker with a detail page + 3 records without one.
// Standing rule from the client: the Compare directory always shows every record in Supabase.
const BROKERS = [
  entity("strong", "Strongly Trusted"),
  entity("trusted", "Trusted"),
  entity("caution", "Proceed With Caution"),
  entity("avoid", "Avoid"),
];

const PROP_FIRMS = [entity("ftmo", "Trusted", "propfirm"), entity("risky", "High Risk", "propfirm"), entity("new", "Not yet rated", "propfirm")];

const guru = (slug: string, verdict: PublicEntity["verdict"]): PublicEntity => ({
  ...entity(slug, verdict, "guru"),
  score: null,
  regulators: [],
  regulatorDetails: [],
  fcaRegistered: false,
  publishable: true,
  reviewed: true,
  citationUrl: verdict === "Caution" ? "https://www.sec.gov/example" : null,
  bioSummary: null,
});

const GURUS = [guru("alice-verified", "Verified"), guru("bob-unverified", "Unverified"), guru("carol-caution", "Caution")];

vi.mock("@/lib/compare/entities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/compare/entities")>()),
  getPublicEntities: vi.fn(async (type: string) =>
    type === "broker" ? BROKERS : type === "propfirm" ? PROP_FIRMS : GURUS,
  ),
}));

const { CompareView } = await import("@/components/marketing/compare-view");

describe("Compare directory", () => {
  it("lists every record from the register, not only those with a detail page", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: {} }));
    expect(html).toContain(`${BROKERS.length} brokers`);
    for (const b of BROKERS) expect(html).toContain(b.name);
  });

  it("lists every prop firm from the register", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "propfirm", searchParams: {} }));
    expect(html).toContain(`${PROP_FIRMS.length} prop firms`);
    for (const f of PROP_FIRMS) expect(html).toContain(f.name);
  });

  it("links every broker row to its detail page — including unrated and cautioned records", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: {} }));
    for (const b of BROKERS) {
      expect(html).toContain(`href="/verify/brokers/${b.slug}"`);
    }
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
