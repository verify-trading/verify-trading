import { describe, expect, it } from "vitest";

import { isEligibleForSignupWelcomeEmail } from "@/lib/email/signup-eligibility";

describe("signup welcome eligibility", () => {
  const nowMs = Date.parse("2026-05-21T12:00:00.000Z");

  it("skips an old account even when the flow claims to be a signup", () => {
    // The flow label rides on a client-controlled cookie / query param, so it must not
    // be able to declare a years-old account eligible.
    expect(
      isEligibleForSignupWelcomeEmail({
        createdAt: "2020-01-01T00:00:00.000Z",
        nowMs,
      }),
    ).toBe(false);
  });

  it("allows a freshly created oauth account", () => {
    expect(
      isEligibleForSignupWelcomeEmail({
        createdAt: "2026-05-21T11:59:55.000Z",
        nowMs,
      }),
    ).toBe(true);
  });

  it("allows recent account creation", () => {
    expect(
      isEligibleForSignupWelcomeEmail({
        createdAt: "2026-05-21T11:58:00.000Z",
        nowMs,
      }),
    ).toBe(true);
  });

  it("allows delayed email confirmation", () => {
    expect(
      isEligibleForSignupWelcomeEmail({
        createdAt: "2026-05-10T00:00:00.000Z",
        emailConfirmedAt: "2026-05-21T11:59:00.000Z",
        nowMs,
      }),
    ).toBe(true);
  });

  it("skips returning users and password-reset style callbacks", () => {
    expect(
      isEligibleForSignupWelcomeEmail({
        createdAt: "2020-01-01T00:00:00.000Z",
        emailConfirmedAt: "2020-01-02T00:00:00.000Z",
        nowMs,
      }),
    ).toBe(false);
  });
});
