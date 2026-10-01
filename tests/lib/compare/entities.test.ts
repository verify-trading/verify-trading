import { describe, expect, it } from "vitest";

import {
  filterEntities,
  parseRegulators,
  PUBLIC_ENTITY_COLUMNS,
  toPublicEntity,
  type PublicEntity,
} from "@/lib/compare/entities";
import { pickHighImpactEvents } from "@/lib/marketing/live-data";

const brokerRow = {
  slug: "examplebroker",
  name: "Example Broker",
  entity_type: "broker",
  status: "legitimate",
  fca_registered: true,
  fca_reference: "123456",
  fca_warning: false,
  regulators_listed: "FCA (United Kingdom), CySEC (Cyprus)",
  final_tier: "Tier 1",
  founder_verified: true,
  leverage: "1:30",
  updated_at: "2026-06-18T12:00:00Z",
  // internal fields that must never leak
  notes: "SECRET notes",
  founder_notes: "SECRET founder",
  internal_notes: "SECRET internal",
  card_facts: { confirmed: [] },
};

describe("public entity mapper", () => {
  it("never selects or outputs internal columns", () => {
    for (const col of ["notes", "founder_notes", "internal_notes", "card_facts", "bio_summary", "prop_terms", "guru_profile", "aliases"]) {
      expect(PUBLIC_ENTITY_COLUMNS.split(", ")).not.toContain(col);
    }
    const out = toPublicEntity(brokerRow)!;
    expect(JSON.stringify(out)).not.toMatch(/SECRET/);
    expect(Object.keys(out)).not.toContain("notes");
  });

  it("scores brokers and parses regulators", () => {
    const out = toPublicEntity(brokerRow)!;
    expect(out.verdict).toBe("Strongly Trusted");
    expect(out.regulators).toEqual(["FCA", "CySEC"]);
    expect(out.reviewed).toBe(true);
    expect(parseRegulators("NONE (Requires Additional Regulation)")).toEqual([]);
  });

  it("marks unscored prop firms as not yet rated and closed firms as avoid", () => {
    const developing = toPublicEntity({ slug: "a", name: "A", entity_type: "propfirm", trust_score: null, firm_status: "Operating — monitoring" })!;
    expect(developing).toMatchObject({ verdict: "Not yet rated", developing: true, score: null });
    const closed = toPublicEntity({ slug: "b", name: "B", entity_type: "propfirm", trust_score: 6, firm_status: "Closed down" })!;
    expect(closed).toMatchObject({ verdict: "Avoid", closed: true });
  });

  it("drops gurus and malformed rows", () => {
    expect(toPublicEntity({ ...brokerRow, entity_type: "guru" })).toBeNull();
    expect(toPublicEntity({ ...brokerRow, slug: "" })).toBeNull();
  });
});

describe("filterEntities", () => {
  const list = [
    toPublicEntity(brokerRow)!,
    toPublicEntity({ ...brokerRow, slug: "b2", name: "Beta FX", final_tier: "Unregulated", founder_verified: false, regulators_listed: null })!,
  ] as PublicEntity[];

  it("filters by name ignoring punctuation and case", () => {
    expect(filterEntities(list, { q: "example-broker" }).map((e) => e.slug)).toEqual(["examplebroker"]);
  });
  it("filters by verdict and regulator", () => {
    expect(filterEntities(list, { verdict: "Avoid" }).map((e) => e.slug)).toEqual(["b2"]);
    expect(filterEntities(list, { regulator: "CySEC" }).map((e) => e.slug)).toEqual(["examplebroker"]);
  });
});

describe("pickHighImpactEvents", () => {
  const ev = (id: string, timeUtc: string, impact: "high" | "low") =>
    ({ id, timeUtc, timeLabel: "", country: "US", currency: "USD", event: id, impact, forecast: null, previous: null }) as const;
  it("keeps only high impact events in the next 7 days, sorted", () => {
    const now = new Date("2026-09-29T10:00:00Z");
    const out = pickHighImpactEvents(
      [ev("late", "2026-10-01T12:00:00Z", "high"), ev("low", "2026-09-30T12:00:00Z", "low"), ev("early", "2026-09-29T08:00:00Z", "high"), ev("far", "2026-10-20T12:00:00Z", "high"), ev("past", "2026-09-28T12:00:00Z", "high")],
      now,
    );
    expect(out.map((e) => e.id)).toEqual(["early", "late"]);
  });
});
