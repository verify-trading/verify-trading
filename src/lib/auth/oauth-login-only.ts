/**
 * Login-only Google OAuth (separate /login vs /signup pages)
 *
 * Official API: `signInWithOAuth` has no `shouldCreateUser` (unlike `signInWithOtp`). OAuth always
 * creates a user if one does not exist — see supabase/auth#1064 and JS reference for signInWithOAuth.
 *
 * Recommended workarounds (Supabase + community): post-auth checks, Auth Hooks, or gate access until
 * required profile data exists. The “Before User Created” hook cannot see our `redirect_to` query
 * (`oauth=login_only` vs `oauth=signup`), so it cannot distinguish login vs signup OAuth without
 * extra machinery.
 *
 * What we do: `/login` marks the OAuth flow as `login_only` before redirect. After
 * `exchangeCodeForSession`, if the user looks like a brand-new Google-only account (single `google`
 * identity + recent `created_at`), we sign out and send them to signup unless the same browser just
 * completed the `/signup` flow. This matches the “route new users after login” pattern; it is UX
 * enforcement for the normal browser flow, not a cryptographic guarantee (a client could skip our
 * callback or call Auth APIs directly — same limitation Supabase maintainers note).
 *
 * @see https://supabase.com/docs/reference/javascript/auth-signinwithoauth
 * @see https://github.com/supabase/auth/issues/1064
 */
import type { User } from "@supabase/supabase-js";

/** Window after account creation where we treat Google-only users as “new signups” (OAuth can be slow). */
const NEW_GOOGLE_ONLY_ACCOUNT_WINDOW_MS = 3 * 60 * 1000;

/**
 * Heuristic: brand-new Google OAuth user (not email+google linking, not an old Google-only account).
 */
export function shouldBlockLoginOnlyGoogleSignup(user: User, nowMs = Date.now()): boolean {
  const identities = user.identities ?? [];
  if (identities.length !== 1 || identities[0]?.provider !== "google") {
    return false;
  }
  const created = new Date(user.created_at).getTime();
  return nowMs - created < NEW_GOOGLE_ONLY_ACCOUNT_WINDOW_MS;
}
