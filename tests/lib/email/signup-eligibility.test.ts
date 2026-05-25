import { describe, expect, it } from "vitest";

import { isEligibleForSignupWelcomeEmail } from "@/lib/email/signup-eligibility";

describe("signup welcome eligibility", () => {
  const nowMs = Date.parse("2026-05-21T12:00:00.000Z");

  it("allows oauth signup flow", () => {
    expect(
      isEligibleForSignupWelcomeEmail({
        oauthFlow: "signup",
        createdAt: "2020-01-01T00:00:00.000Z",
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
        oauthFlow: "login_only",
        createdAt: "2020-01-01T00:00:00.000Z",
        emailConfirmedAt: "2020-01-02T00:00:00.000Z",
        nowMs,
      }),
    ).toBe(false);
  });
});
