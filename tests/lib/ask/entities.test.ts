import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { clearVerifiedEntitiesCache, lookupVerifiedEntity, upsertDevelopingPropFirm } from "@/lib/ask/entities";
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
    slug: "alpha-futures",
    name: "Alpha Futures",
    entity_type: "propfirm",
    status: "warning",
    trust_score: null,
    notes: "Developing record: no final trust score while the payout position is unverified.",
    source: "Alpha Futures monitoring record",
    aliases: ["alpha futures", "alphafutures"],
    firm_status: "Operating — monitoring",
    trustpilot_rating: 4.8,
    trustpilot_count: 5384,
    trustpilot_date: "2026-07-13",
    research_status: "DEVELOPING — MONITOR",
    card_facts: {
      confirmed: [{ text: "Active Premium accounts are being closed and refunded.", sourceLabel: "Alpha announcement", sourceUrl: "https://example.com/alpha" }],
      unconfirmed: ["The payout-denial claim is unconfirmed."],
      footer: "Re-verify when Alpha publishes its official statement.",
    },
  },
  {
    slug: "alpha-capital-group",
    name: "Alpha Capital Group",
    entity_type: "propfirm",
    status: "legitimate",
    trust_score: 8.4,
    notes: "Separate record.",
    source: "research",
    aliases: ["alpha capital group", "alpha capital"],
  },
  {
    // Developing record whose confirmed fact carries an unsafe (non-http) link:
    // the reader must keep the fact but drop the URL, never render it as an href.
    slug: "beta-funding",
    name: "Beta Funding",
    entity_type: "propfirm",
    status: "warning",
    trust_score: null,
    notes: "Developing record.",
    source: "Live web research",
    aliases: ["beta funding", "betafunding"],
    firm_status: "Operating — monitoring",
    research_status: "DEVELOPING — MONITOR",
    card_facts: {
      confirmed: [
        { text: "Firm published a payout policy update.", sourceLabel: "Beta notice", sourceUrl: "javascript:alert(1)" },
        { text: "Registered as an LLC.", sourceLabel: "Registry", sourceUrl: "trustpilot.com/review/x" },
      ],
      unconfirmed: [],
      footer: null,
    },
  },
  {
    // Regulated broker awaiting a live-register re-check: NOT founder-locked and its
    // verification_method still says "NEEDS FCA-API". With a real Tier-1 standing and
    // regulators on file it must score, never fall back to "Provisional".
    slug: "pepperstone",
    name: "Pepperstone",
    entity_type: "broker",
    status: "legitimate",
    fca_registered: true,
    fca_reference: "684312",
    final_tier: "Tier 1",
    final_status: "LEGITIMATE",
    founder_verified: false,
    regulators_listed: "FCA, ASIC, CySEC, DFSA",
    verification_method: "NEEDS FCA-API",
    notes: "FCA authorised. Top tier execution. Low spreads.",
    source: "FCA Register",
    aliases: ["pepperstone"],
  },
  {
    // Genuinely unknown firm: no regulator on file and only a needs-verification
    // method — this is the case "Provisional" is actually reserved for.
    slug: "obscure-fx",
    name: "Obscure FX",
    entity_type: "broker",
    status: "warning",
    final_tier: "Unregulated",
    final_status: "CAUTION",
    founder_verified: false,
    regulators_listed: null,
    verification_method: "NEEDS register check",
    notes: "No regulator located.",
    source: "research",
    aliases: ["obscure fx", "obscurefx"],
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

  it("scores a regulated broker awaiting a register re-check, not Provisional", async () => {
    const result = await lookupVerifiedEntity("Is Pepperstone safe for UK retail CFD?");

    expect(result.found).toBe(true);
    expect(result.entity?.name).toBe("Pepperstone");
    expect(result.entity?.provisional).toBe(false);
    // Tier 1 → a real numeric grade, never the "Provisional" placeholder.
    expect(result.brokerCardHint?.score).toBe("9.0");
  });

  it("keeps Provisional for a genuinely unknown, unregulated broker", async () => {
    const result = await lookupVerifiedEntity("Is Obscure FX legit?");

    expect(result.found).toBe(true);
    expect(result.entity?.provisional).toBe(true);
    expect(result.brokerCardHint?.score).toBe("Provisional");
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

  it("resolves Alpha Futures to its developing record, not Alpha Capital Group", async () => {
    const result = await lookupVerifiedEntity("Is Alpha Futures safe?");

    expect(result.entity?.name).toBe("Alpha Futures");
    expect(result.propFirmCardHint).toMatchObject({
      score: "Not yet rated",
      status: "WARNING",
      researchStatus: "DEVELOPING — MONITOR",
      trustpilot: { rating: 4.8, count: 5384, date: "2026-07-13" },
    });
    expect(result.propFirmCardHint?.cardFacts?.unconfirmed).toEqual(["The payout-denial claim is unconfirmed."]);
  });

  it("drops an unsafe source link but keeps the confirmed fact", async () => {
    const result = await lookupVerifiedEntity("Is Beta Funding safe?");

    expect(result.entity?.name).toBe("Beta Funding");
    const confirmed = result.propFirmCardHint?.cardFacts?.confirmed ?? [];
    expect(confirmed).toHaveLength(2);
    // javascript: and scheme-less URLs are both rejected; text survives.
    expect(confirmed[0]).toMatchObject({ text: "Firm published a payout policy update.", sourceUrl: null });
    expect(confirmed[1]).toMatchObject({ text: "Registered as an LLC.", sourceUrl: null });
  });

  it("refuses to overwrite an existing scored record", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { trust_score: 9.1, research_status: null }, error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: () => ({ upsert, select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as never);

    const result = await upsertDevelopingPropFirm({
      name: "FTMO",
      confirmed: [{ text: "A cited fact.", sourceLabel: "Source", sourceUrl: "https://example.com/x" }],
    });

    expect(result.saved).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores review-source claims as unconfirmed on a newly discovered prop firm", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    // No existing row: discovery is free to create a fresh developing record.
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: () => ({
        upsert,
        select: () => ({ eq: () => ({ maybeSingle }) }),
      }),
    } as never);

    const result = await upsertDevelopingPropFirm({
      name: "Example Funding",
      confirmed: [
        {
          text: "Traders report delayed withdrawals.",
          sourceLabel: "Trustpilot Reviews",
          sourceUrl: "https://www.trustpilot.com/review/example-funding.test",
        },
        {
          text: "The firm announced a platform migration.",
          sourceLabel: "Example Funding notice",
          sourceUrl: "https://example-funding.test/notices/migration",
        },
      ],
    });

    expect(result).toEqual({ saved: true, slug: "examplefunding" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        research_status: "DEVELOPING — MONITOR",
        trust_score: null,
        card_facts: expect.objectContaining({
          confirmed: [expect.objectContaining({ text: "The firm announced a platform migration." })],
          unconfirmed: [expect.stringContaining("Traders report delayed withdrawals.")],
        }),
      }),
      { onConflict: "slug" },
    );
  });
});
