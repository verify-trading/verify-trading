import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { toPublicEntity, type PublicEntity } from "@/lib/compare/entities";
import { VsView } from "@/components/marketing/vs-view";

const broker = (slug: string, over: Record<string, unknown> = {}) =>
  toPublicEntity({ slug, name: slug.toUpperCase(), entity_type: "broker", status: "legitimate", final_tier: "Tier 1", founder_verified: true, regulators_listed: "FCA (United Kingdom), CySEC (Cyprus)", updated_at: "2026-06-18T12:00:00Z", ...over })!;
const prop = (slug: string, over: Record<string, unknown> = {}) =>
  toPublicEntity({ slug, name: slug.toUpperCase(), entity_type: "propfirm", firm_status: "Operating", trust_score: 8, updated_at: "2026-06-18T12:00:00Z", ...over })!;

describe("VsView", () => {
  it("broker comparison shows both names and the regulators block", () => {
    const html = renderToStaticMarkup(<VsView a={broker("alpha")} b={broker("zeta", { regulators_listed: "ASIC (Australia)" })} />);
    expect(html).toContain("ALPHA vs ZETA");
    expect(html).toContain("Broker comparison");
    expect(html).toContain("Regulators compared");
    expect(html).toContain("FCA register");
    expect(html).toContain("comparison of records, not a recommendation");
  });

  it("prop firm comparison shows score/status rows and no regulator block", () => {
    const html = renderToStaticMarkup(<VsView a={prop("apex", { trust_score: 7.2 })} b={prop("ftmo", { trust_score: 8.5 })} />);
    expect(html).toContain("APEX vs FTMO");
    expect(html).toContain("Prop firm comparison");
    expect(html).not.toContain("Regulators compared");
    expect(html).not.toContain("FCA register");
    expect(html).toContain("Status");
    expect(html).toContain("comparison of records, not a recommendation");
  });
});

describe("resolveVsPage", () => {
  const BROKERS: PublicEntity[] = [broker("alpha"), broker("zeta")];

  it("redirects a non-canonical ordering to the sorted URL, 404s unknown/self", async () => {
    vi.resetModules();
    vi.doMock("@/lib/compare/entities", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/compare/entities")>()),
      getPublicEntities: vi.fn(async () => BROKERS),
    }));
    const { resolveVsPage } = await import("@/lib/compare/vs-page");

    expect(await resolveVsPage("broker", "zeta-vs-alpha")).toEqual({ kind: "redirect", to: "/compare/brokers/alpha-vs-zeta" });
    const ok = await resolveVsPage("broker", "alpha-vs-zeta");
    expect(ok.kind).toBe("ok");
    expect((await resolveVsPage("broker", "alpha-vs-ghost")).kind).toBe("notFound");
    expect((await resolveVsPage("broker", "alpha-vs-alpha")).kind).toBe("notFound");
    expect((await resolveVsPage("broker", "garbage")).kind).toBe("notFound");
    vi.doUnmock("@/lib/compare/entities");
  });
});
