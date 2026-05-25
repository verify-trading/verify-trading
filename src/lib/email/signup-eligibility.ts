import type { OAuthFlow } from "@/lib/auth/oauth-flow";
import { isRecentAuthTimestamp } from "@/lib/auth/recent-auth-event";

type SignupWelcomeEligibilityInput = {
  oauthFlow?: OAuthFlow | null;
  createdAt?: string | null;
  emailConfirmedAt?: string | null;
  nowMs?: number;
};

export function isEligibleForSignupWelcomeEmail({
  oauthFlow,
  createdAt,
  emailConfirmedAt,
  nowMs = Date.now(),
}: SignupWelcomeEligibilityInput): boolean {
  if (oauthFlow === "signup") {
    return true;
  }

  return isRecentAuthTimestamp(createdAt, nowMs) || isRecentAuthTimestamp(emailConfirmedAt, nowMs);
}
