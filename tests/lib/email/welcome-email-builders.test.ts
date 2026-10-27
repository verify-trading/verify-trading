import { describe, expect, it } from "vitest";

import { buildSignupWelcomeEmail } from "@/lib/email/send-signup-welcome";

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
    expect(email.text).toContain(
      "You’ve just found a tool traders use to make better, more informed decisions and avoid scams.",
    );
    expect(email.text).toContain(`${appOrigin}/ask`);
    expect(email.html).toContain("https://www.verify.trading/verify-trading-email-logo.png");
    expect(email.html).toContain("Welcome to the winning team!");
  });
});
