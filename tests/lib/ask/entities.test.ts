import { describe, expect, it } from "vitest";

import { lookupVerifiedEntity } from "@/lib/ask/entities";

describe("lookupVerifiedEntity", () => {
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
