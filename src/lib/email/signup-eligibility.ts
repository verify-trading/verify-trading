import { isRecentAuthTimestamp } from "@/lib/auth/recent-auth-event";

type SignupWelcomeEligibilityInput = {
  createdAt?: string | null;
  emailConfirmedAt?: string | null;
  nowMs?: number;
};

/**
 * Decided from server-side user state only. An earlier version short-circuited to
 * `true` whenever the OAuth flow was labelled `signup`, but that label rides on a
 * cookie / `?oauth=` query param the client controls — so an account created years
 * ago could be declared a fresh signup just by clicking "Sign up with Google" (or by
 * hitting `/auth/callback?oauth=signup` directly). `created_at` / `email_confirmed_at`
 * are Supabase's own timestamps, and a genuine OAuth signup is seconds old by the time
 * the callback runs, so the recency window covers it without the spoofable hint.
 */
export function isEligibleForSignupWelcomeEmail({
  createdAt,
  emailConfirmedAt,
  nowMs = Date.now(),
}: SignupWelcomeEligibilityInput): boolean {
  return isRecentAuthTimestamp(createdAt, nowMs) || isRecentAuthTimestamp(emailConfirmedAt, nowMs);
}
