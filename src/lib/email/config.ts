function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getResendApiKey(): string | null {
  return readOptionalEnv("RESEND_API_KEY");
}

/** Signup / free-account welcome (Ask onboarding). */
export function getSignupEmailFromAddress(): string {
  return (
    readOptionalEnv("EMAIL_FROM_SIGNUP") ??
    readOptionalEnv("EMAIL_FROM") ??
    "verify.trading <ai@verify.trading>"
  );
}

/** Pro subscription welcome after Stripe checkout. */
export function getSubscriptionEmailFromAddress(): string {
  return readOptionalEnv("EMAIL_FROM_SUBSCRIPTION") ?? "verify.trading <pro@verify.trading>";
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendApiKey());
}
