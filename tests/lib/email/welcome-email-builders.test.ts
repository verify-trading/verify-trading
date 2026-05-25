import { describe, expect, it } from "vitest";

import { buildSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";
import { buildSubscriptionWelcomeEmail } from "@/lib/email/send-subscription-welcome";

const appOrigin = "https://verify.trading";

describe("welcome email builders", () => {
  it("builds the signup welcome email with the branded template", () => {
    const email = buildSignupWelcomeEmail({
      email: "trader@example.com",
      displayName: "Afaq",
      appOrigin,
    });

    expect(email.subject).toBe("Welcome to verify.trading");
    expect(email.text).toContain("Hi Afaq,");
    expect(email.text).toContain(`${appOrigin}/ask`);
    expect(email.html).toContain("https://www.verify.trading/verify-trading-email-logo.png");
    expect(email.html).toContain("Welcome to the winning team!");
  });

  it("builds the Pro welcome email with the branded Pro copy", () => {
    const email = buildSubscriptionWelcomeEmail({
      email: "trader@example.com",
      displayName: "Afaq",
      planKey: "monthly",
      appOrigin,
    });

    expect(email.subject).toBe(
      "Your verify.trading Pro Monthly subscription is active",
    );
    expect(email.text).toContain("The Ask tab: unlimited. No daily limit.");
    expect(email.html).toContain("The Ask tab: unlimited. No daily limit.");
    expect(email.text).toContain("You belong here.");
  });
});
