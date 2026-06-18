import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { clearVerifiedEntitiesCache, lookupVerifiedEntity } from "@/lib/ask/entities";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Rows shaped like the verified_entities columns the loader reads; unset columns
// resolve to null/false, exactly as Supabase returns them.
const seedRows: Record<string, unknown>[] = [
  {
    slug: "ftmo",
    name: "FTMO",
    entity_type: "propfirm",
    status: "legitimate",
    trust_score: 9.1,
    notes: "Most trusted prop firm globally.",
    source: "verify.trading research",
    aliases: ["ftmo"],
    trustpilot_rating: 4.8,
    trustpilot_count: 30000,
  },
  {
    slug: "trading212",
    name: "Trading212",
    entity_type: "broker",
    status: "legitimate",
    fca_registered: true,
    fca_reference: "609146",
    trust_score: 8,
    final_tier: "Tier 1",
    founder_verified: true,
    notes: "FCA authorised.",
    source: "FCA Register",
    aliases: ["trading212", "trading 212"],
  },
  {
    slug: "switzyman",
    name: "SwitzyMan",
    entity_type: "guru",
    status: "avoid",
    notes: "FCA warning issued October 2024.",
    source: "FCA Warning fca.org.uk",
    aliases: ["switzyman"],
    guru_tier: "Caution",
    regulator_flag_source: "https://www.fca.org.uk/news/warnings/switzyman",
    verified_track_record: "No",
    bio_summary: "Named on the FCA Warning List for unauthorised financial promotions.",
    research_status: "RESEARCHED (FCA-confirmed)",
    founder_reviewed: true,
    identity_confirmed: true,
  },
  {
    slug: "ghostguru",
    name: "GhostGuru",
    entity_type: "guru",
    status: "legitimate",
    notes: "Thin directory entry.",
    source: "Directory",
    aliases: ["ghostguru"],
    guru_tier: "Unverified",
    research_status: "DIRECTORY-THIN (verify before publish)",
    founder_reviewed: false,
  },
  {
    slug: "the5ers",
    name: "The5ers",
    entity_type: "propfirm",
    status: "legitimate",
    trust_score: 8.6,
    notes: "Not FCA but well established prop firm.",
    source: "Community research",
    aliases: ["the5ers", "the 5 ers"],
  },
  {
    // Precision trap: collapse("zentova markets") = "zentovamarkets" CONTAINS
    // "amarkets" as a trailing substring. Resolution must NOT match this firm.
    slug: "amarkets",
    name: "AMarkets",
    entity_type: "broker",
    status: "warning",
    trust_score: 5,
    notes: "Not FCA regulated.",
    source: "research",
    aliases: ["amarkets"],
  },
];

describe("lookupVerifiedEntity", () => {
  beforeEach(() => {
    clearVerifiedEntitiesCache();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: () => ({
        select: () => Promise.resolve({ data: seedRows, error: null }),
      }),
    } as never);
  });

  afterEach(() => {
    clearVerifiedEntitiesCache();
    vi.clearAllMocks();
  });

  it("matches exact seeded entities", async () => {
    const result = await lookupVerifiedEntity("FTMO");

    expect(result.found).toBe(true);
    expect(result.entity?.name).toBe("FTMO");
    expect(result.propFirmCardHint?.status).toBe("LEGITIMATE");
  });

  it("matches alias-like user phrasing", async () => {
    const result = await lookupVerifiedEntity("Is Trading 212 safe to use?");

    expect(result.found).toBe(true);
    expect(result.entity?.name).toBe("Trading212");
    expect(result.brokerCardHint?.fca).toBe("Yes");
  });

  it("returns a safe miss when the entity is unknown", async () => {
    const result = await lookupVerifiedEntity("Unknown Alpha Broker");

    expect(result.found).toBe(false);
    expect(result.entity).toBeUndefined();
    expect(result.brokerCardHint).toBeUndefined();
  });

  it("never resolves a lookalike via a trailing substring (zentova !-> AMarkets)", async () => {
    // collapse("zentova markets") contains "amarkets" — a bare substring must
    // not produce a false verdict for the unrelated firm AMarkets.
    const result = await lookupVerifiedEntity("is zentova markets legit");

    expect(result.found).toBe(false);
  });

  it("resolves spacing variants of a digit brand (the 5ers -> The5ers)", async () => {
    const result = await lookupVerifiedEntity("is the 5ers any good");

    expect(result.found).toBe(true);
    expect(result.entity?.name).toBe("The5ers");
  });

  it("resolves a cited guru to Caution with its citation link", async () => {
    const result = await lookupVerifiedEntity("Is SwitzyMan legitimate?");

    expect(result.found).toBe(true);
    expect(result.entity?.type).toBe("guru");
    expect(result.guruCardHint?.tier).toBe("Caution");
    expect(result.guruCardHint?.citationUrl).toContain("fca.org.uk");
  });

  it("excludes unpublishable gurus from matching", async () => {
    const result = await lookupVerifiedEntity("What about GhostGuru?");

    expect(result.found).toBe(false);
  });

  it("returns prop firms through the prop-firm card hint", async () => {
    const result = await lookupVerifiedEntity("What about The5ers?");

    expect(result.found).toBe(true);
    expect(result.entity?.type).toBe("propfirm");
    expect(result.propFirmCardHint?.status).toBe("LEGITIMATE");
    expect(result.propFirmCardHint?.band).toBe("Strongly Trusted");
  });
});
