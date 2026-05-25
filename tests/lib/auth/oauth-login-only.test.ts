import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { shouldBlockLoginOnlyGoogleSignup } from "@/lib/auth/oauth-login-only";

type TestIdentity = NonNullable<User["identities"]>[number];

function makeUser(partial: Partial<User> & { created_at: string }): User {
  return partial as User;
}

describe("shouldBlockLoginOnlyGoogleSignup", () => {
  const now = new Date("2026-01-15T12:00:00.000Z").getTime();

  it("returns true for brand-new Google-only user", () => {
    const user = makeUser({
      created_at: "2026-01-15T11:59:30.000Z",
      identities: [{ provider: "google" } as TestIdentity],
    });
    expect(shouldBlockLoginOnlyGoogleSignup(user, now)).toBe(true);
  });

  it("returns false for older Google-only user", () => {
    const user = makeUser({
      created_at: "2025-01-01T00:00:00.000Z",
      identities: [{ provider: "google" } as TestIdentity],
    });
    expect(shouldBlockLoginOnlyGoogleSignup(user, now)).toBe(false);
  });

  it("returns false when email + google identities exist", () => {
    const user = makeUser({
      created_at: "2026-01-15T11:59:30.000Z",
      identities: [
        { provider: "email" } as TestIdentity,
        { provider: "google" } as TestIdentity,
      ],
    });
    expect(shouldBlockLoginOnlyGoogleSignup(user, now)).toBe(false);
  });

  it("returns false for email-only new user", () => {
    const user = makeUser({
      created_at: "2026-01-15T11:59:30.000Z",
      identities: [{ provider: "email" } as TestIdentity],
    });
    expect(shouldBlockLoginOnlyGoogleSignup(user, now)).toBe(false);
  });
});
