import { describe, expect, it } from "vitest";

import { buildSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";
import { buildSubscriptionWelcomeEmail } from "@/lib/email/send-subscription-welcome";
import { PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

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
    expect(email.html).toContain("https://www.verify.trading/verify-trading-logo.png");
    expect(email.html).toContain("Welcome to verify.trading");
  });

  it("builds the Pro welcome email with the current Ask usage limit", () => {
    const email = buildSubscriptionWelcomeEmail({
      email: "trader@example.com",
      displayName: "Afaq",
      planKey: "monthly",
      appOrigin,
    });

    expect(email.subject).toBe(
      "Your verify.trading Pro Monthly subscription is active",
    );
    expect(email.text).toContain(`Ask gives you ${PRO_DAILY_ASK_LIMIT} chats per day`);
    expect(email.html).toContain(`Ask gives you ${PRO_DAILY_ASK_LIMIT} chats per day`);
    expect(email.text).not.toMatch(/unlimited/i);
    expect(email.html).not.toMatch(/unlimited/i);
  });
});
