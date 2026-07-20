import { describe, expect, it } from "vitest";

import type { AskResponse } from "@/lib/ask/contracts";
import type { VerifiedEntity } from "@/lib/ask/entities";
import {
  buildAskResponseCacheKey,
  isGenericEntityLookup,
  responseIsCacheable,
} from "@/lib/ask/response-cache";

function makeEntity(overrides: Partial<VerifiedEntity> = {}): VerifiedEntity {
  return {
    id: "alpha-futures",
    name: "Alpha Futures",
    normalizedName: "alpha futures",
    type: "propfirm",
    status: "legitimate",
    fcaRegistered: false,
    fcaReference: null,
    fcaWarning: false,
    trustScore: 7.2,
    notes: "",
    source: "bts",
    aliases: ["alpha futures"],
    collapsedAliases: ["alphafutures"],
    ...overrides,
  };
}

describe("isGenericEntityLookup", () => {
  const entity = makeEntity();

  it("accepts bare lookups in common phrasings", () => {
    expect(isGenericEntityLookup("alpha futures", entity)).toBe(true);
    expect(isGenericEntityLookup("is Alpha Futures legit?", entity)).toBe(true);
    expect(isGenericEntityLookup("Alpha Futures scam??", entity)).toBe(true);
    expect(isGenericEntityLookup("is alphafutures trustworthy", entity)).toBe(true);
    expect(isGenericEntityLookup("should i trust alpha futures", entity)).toBe(true);
    expect(isGenericEntityLookup("alpha futures prop firm review", entity)).toBe(true);
  });

  it("rejects questions that go beyond a lookup", () => {
    // Comparison: a second firm makes the answer multi-entity.
    expect(isGenericEntityLookup("alpha futures vs ftmo", entity)).toBe(false);
    // Personal stakes and specifics need the model, not a shared answer.
    expect(isGenericEntityLookup("can i trust alpha futures with $50k", entity)).toBe(false);
    expect(isGenericEntityLookup("alpha futures payout time", entity)).toBe(false);
    expect(isGenericEntityLookup("how do i withdraw from alpha futures", entity)).toBe(false);
  });

  it("rejects messages that never name the entity", () => {
    expect(isGenericEntityLookup("is it legit?", entity)).toBe(false);
    expect(isGenericEntityLookup("", entity)).toBe(false);
  });
});

describe("buildAskResponseCacheKey", () => {
  it("is stable for the same entity row and model", () => {
    const a = buildAskResponseCacheKey(makeEntity(), "claude-sonnet-4-6");
    const b = buildAskResponseCacheKey(makeEntity(), "claude-sonnet-4-6");
    expect(a).toBe(b);
    expect(a).toContain("alpha-futures");
  });

  it("changes when the register row changes", () => {
    const before = buildAskResponseCacheKey(makeEntity(), "claude-sonnet-4-6");
    const after = buildAskResponseCacheKey(makeEntity({ trustScore: 3.1 }), "claude-sonnet-4-6");
    expect(before).not.toBe(after);
  });

  it("changes when a warning is added", () => {
    const before = buildAskResponseCacheKey(makeEntity(), "claude-sonnet-4-6");
    const after = buildAskResponseCacheKey(makeEntity({ fcaWarning: true }), "claude-sonnet-4-6");
    expect(before).not.toBe(after);
  });

  it("changes when the model changes", () => {
    const sonnet = buildAskResponseCacheKey(makeEntity(), "claude-sonnet-4-6");
    const haiku = buildAskResponseCacheKey(makeEntity(), "claude-haiku-4-5");
    expect(sonnet).not.toBe(haiku);
  });
});

describe("responseIsCacheable", () => {
  const entity = makeEntity();

  function makeResponse(data: AskResponse["data"]): AskResponse {
    return {
      data,
      uiMeta: undefined,
      sessionId: "11111111-1111-4111-8111-111111111111",
      messageId: "22222222-2222-4222-8222-222222222222",
    };
  }

  const brokerCard: AskResponse["data"] = {
    type: "broker",
    name: "Alpha Futures",
    score: "7.2",
    status: "LEGITIMATE",
    fca: "No",
    complaints: "Low",
    verdict: "Solid record so far.",
    color: "green",
  };

  it("accepts a broker card about the resolved entity", () => {
    expect(responseIsCacheable(makeResponse(brokerCard), entity)).toBe(true);
  });

  it("accepts spacing variants of the entity name on the card", () => {
    expect(
      responseIsCacheable(makeResponse({ ...brokerCard, name: "AlphaFutures" }), entity),
    ).toBe(true);
  });

  it("rejects a card about a different firm", () => {
    expect(
      responseIsCacheable(makeResponse({ ...brokerCard, name: "Alpha Capital Group" }), entity),
    ).toBe(false);
  });

  it("rejects non-verdict card types", () => {
    expect(
      responseIsCacheable(
        makeResponse({
          type: "insight",
          headline: "Alpha Futures",
          body: "Some analysis.",
          verdict: "Wait.",
        }),
        entity,
      ),
    ).toBe(false);
  });
});
