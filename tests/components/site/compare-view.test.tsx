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

vi.mock("@/lib/compare/entities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/compare/entities")>()),
  getPublicEntities: vi.fn(async (type: string) => (type === "broker" ? BROKERS : PROP_FIRMS)),
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

  it("links only records that have a live detail page", async () => {
    const html = renderToStaticMarkup(await CompareView({ type: "broker", searchParams: {} }));
    expect(html).toContain('href="/verify/brokers/strong"');
    expect(html).not.toContain('href="/verify/brokers/trusted"');
    expect(html).not.toContain('href="/verify/brokers/avoid"');
  });
});
