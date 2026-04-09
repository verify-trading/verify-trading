import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VerifiedEntity } from "@/lib/ask/entities";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { clearVerifiedEntitiesCache, lookupVerifiedEntity } from "@/lib/ask/entities";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const seedLikeRows: VerifiedEntity[] = [
  {
    id: "ftmo",
    name: "FTMO",
    type: "propfirm",
    status: "legitimate",
    fcaRegistered: false,
    fcaReference: null,
    fcaWarning: false,
    trustScore: 9.1,
    notes: "Most trusted prop firm globally.",
    source: "verify.trading research",
    aliases: ["ftmo"],
  },
  {
    id: "trading212",
    name: "Trading212",
    type: "broker",
    status: "legitimate",
    fcaRegistered: true,
    fcaReference: "609146",
    fcaWarning: false,
    trustScore: 8,
    notes: "FCA authorised.",
    source: "FCA Register",
    aliases: ["trading212", "trading 212"],
  },
  {
    id: "switzyman",
    name: "SwitzyMan",
    type: "guru",
    status: "avoid",
    fcaRegistered: false,
    fcaReference: null,
    fcaWarning: true,
    trustScore: 1.2,
    notes: "FCA warning issued October 2024.",
    source: "FCA Warning fca.org.uk",
    aliases: ["switzyman"],
  },
  {
    id: "the5ers",
    name: "The5ers",
    type: "propfirm",
    status: "legitimate",
    fcaRegistered: false,
    fcaReference: null,
    fcaWarning: false,
    trustScore: 8.6,
    notes: "Not FCA but well established prop firm.",
    source: "Community research",
    aliases: ["the5ers", "the 5 ers"],
  },
];

describe("lookupVerifiedEntity", () => {
  beforeEach(() => {
    clearVerifiedEntitiesCache();
    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: () => ({
        select: () =>
          Promise.resolve({
            data: seedLikeRows.map((e) => ({
              slug: e.id,
              name: e.name,
              entity_type: e.type,
              status: e.status,
              fca_registered: e.fcaRegistered,
              fca_reference: e.fcaReference,
              fca_warning: e.fcaWarning,
              trust_score: e.trustScore,
              notes: e.notes,
              source: e.source,
              aliases: e.aliases,
            })),
            error: null,
          }),
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
    expect(result.brokerCardHint?.status).toBe("LEGITIMATE");
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

  it("matches guru entities and exposes guru card hints", async () => {
    const result = await lookupVerifiedEntity("Is SwitzyMan legitimate?");

    expect(result.found).toBe(true);
    expect(result.entity?.type).toBe("guru");
    expect(result.guruCardHint?.status).toBe("AVOID");
    expect(result.guruCardHint?.verified).toBe("No");
  });

  it("matches prop firms through broker-style lookup", async () => {
    const result = await lookupVerifiedEntity("What about The5ers?");

    expect(result.found).toBe(true);
    expect(result.entity?.type).toBe("propfirm");
    expect(result.brokerCardHint?.status).toBe("LEGITIMATE");
  });
});
