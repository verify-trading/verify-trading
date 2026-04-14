import { describe, expect, it } from "vitest";

import { deriveMarketsAccessTier } from "@/lib/markets/derive-markets-access-tier";

describe("deriveMarketsAccessTier", () => {
  it("returns signed_out when auth is ready but user is not signed in", () => {
    expect(
      deriveMarketsAccessTier({
        authReady: true,
        isSignedIn: false,
        initialTier: undefined,
        accountMenu: { isError: false, isPending: false, data: undefined },
      }),
    ).toBe("signed_out");
  });

  it("uses initial tier while auth is not ready", () => {
    expect(
      deriveMarketsAccessTier({
        authReady: false,
        isSignedIn: true,
        initialTier: "pro",
        accountMenu: { isError: false, isPending: true, data: undefined },
      }),
    ).toBe("pro");
  });

  it("falls back to free on account menu error", () => {
    expect(
      deriveMarketsAccessTier({
        authReady: true,
        isSignedIn: true,
        initialTier: "pro",
        accountMenu: { isError: true, isPending: false, data: undefined },
      }),
    ).toBe("free");
  });

  it("resolves pro from profile tier", () => {
    expect(
      deriveMarketsAccessTier({
        authReady: true,
        isSignedIn: true,
        initialTier: "free",
        accountMenu: {
          isError: false,
          isPending: false,
          data: {
            profile: {
              display_name: null,
              username: null,
              tier: "pro",
              created_at: "2026-01-01T00:00:00.000Z",
              preferences: null,
            },
            usage: null,
          },
        },
      }),
    ).toBe("pro");
  });
});
