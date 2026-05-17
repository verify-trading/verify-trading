/**
 * OAuth PKCE callback: `exchangeCodeForSession` must run on the server so session cookies are set.
 *
 * Login-only Google: when `oauth=login_only` (set only from /login), reject apparent new Google-only
 * signups after session exchange and delete the just-created auth user when admin cleanup is available
 * — see `shouldBlockLoginOnlyGoogleSignup` and `src/lib/auth/oauth-login-only.ts`.
 *
 * Affiliate Lead tracking: if the user has a Rewardful referral cookie, attach
 * the referral UUID to their Stripe customer record so Rewardful counts it as a Lead.
 */
import { NextResponse } from "next/server";

import {
  AUTH_REDIRECT_COOKIE_NAME,
  OAUTH_FLOW_COOKIE_NAME,
  parseOAuthFlow,
  readCookie,
  RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  RECENT_OAUTH_SIGNUP_COOKIE_NAME,
} from "@/lib/auth/oauth-flow";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { shouldBlockLoginOnlyGoogleSignup } from "@/lib/auth/oauth-login-only";
import { ensureStripeCustomerForUser } from "@/lib/billing/repository";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOGIN_OAUTH_ERROR_CODE = "oauth_login_no_account";
const REWARDFUL_REFERRAL_COOKIE_NAME = "rewardful.referral";
const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

function clearOAuthFlowCookie(response: NextResponse) {
  response.cookies.set(OAUTH_FLOW_COOKIE_NAME, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

function clearAuthRedirectCookie(response: NextResponse) {
  response.cookies.set(AUTH_REDIRECT_COOKIE_NAME, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

function setRecentOauthSignupCookie(response: NextResponse, userId: string) {
  response.cookies.set(RECENT_OAUTH_SIGNUP_COOKIE_NAME, userId, {
    ...AUTH_COOKIE_OPTIONS,
    httpOnly: true,
    maxAge: RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Extract the Rewardful referral UUID from the cookie value.
 * The cookie stores a JSON object like {"id":"<uuid>","..."}.
 * Returns null if the cookie is missing or malformed.
 */
function extractRewardfulReferralId(cookieHeader: string | null): string | null {
  const rawCookie = readCookie(cookieHeader, REWARDFUL_REFERRAL_COOKIE_NAME);
  if (!rawCookie) return null;

  try {
    const decoded = decodeURIComponent(rawCookie);
    const parsed = JSON.parse(decoded) as { id?: string };
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch (parseError) {
    logger.warn("Failed to parse Rewardful referral cookie.", {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}

/**
 * Link the newly-signed-up user to a Stripe customer with the affiliate referral
 * attached. This is what enables Rewardful to count the signup as a Lead.
 * Silently fails — never block the redirect over affiliate tracking.
 */
async function linkAffiliateReferralServerSide(
  userId: string,
  email: string | null | undefined,
  displayName: string | null | undefined,
  referralId: string,
) {
  try {
    await ensureStripeCustomerForUser({
      userId,
      email,
      displayName,
      referralId,
    });
  } catch (linkError) {
    logger.warn("Failed to link affiliate referral in OAuth callback.", {
      userId,
      error: linkError instanceof Error ? linkError.message : String(linkError),
    });
  }
}

async function deleteBlockedLoginOnlyGoogleSignup(userId: string) {
  const supabaseAdmin = getSupabaseAdminClient();

  if (!supabaseAdmin) {
    logger.warn("Supabase admin client unavailable while cleaning up blocked login-only OAuth user.", {
      userId,
    });
    return;
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    logger.error("Failed to delete blocked login-only OAuth user.", {
      userId,
      error: error.message,
    });
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const cookieHeader = request.headers.get("cookie");
  const code = searchParams.get("code");
  const next =
    searchParams.get("next") ?? readCookie(cookieHeader, AUTH_REDIRECT_COOKIE_NAME);
  const oauthFlow = parseOAuthFlow(
    readCookie(cookieHeader, OAUTH_FLOW_COOKIE_NAME) ?? searchParams.get("oauth"),
  );
  const recentOauthSignupUserId = readCookie(cookieHeader, RECENT_OAUTH_SIGNUP_COOKIE_NAME);

  if (!code) {
    const response = NextResponse.redirect(new URL("/login?error=auth_code", origin));
    clearOAuthFlowCookie(response);
    clearAuthRedirectCookie(response);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
    clearOAuthFlowCookie(response);
    clearAuthRedirectCookie(response);
    return response;
  }

  if (
    oauthFlow === "login_only" &&
    data.user &&
    shouldBlockLoginOnlyGoogleSignup(data.user) &&
    recentOauthSignupUserId !== data.user.id
  ) {
    await supabase.auth.signOut();
    await deleteBlockedLoginOnlyGoogleSignup(data.user.id);
    const login = new URL("/login", origin);
    login.searchParams.set("error", LOGIN_OAUTH_ERROR_CODE);
    const response = NextResponse.redirect(login);
    clearOAuthFlowCookie(response);
    clearAuthRedirectCookie(response);
    return response;
  }

  // Affiliate Lead tracking: if this user has a Rewardful referral cookie,
  // create or update a Stripe customer with the referral UUID attached.
  // Rewardful will pick it up via Stripe sync and count it as a Lead.
  // Works for: Google OAuth signups, email-verification clickbacks, and OAuth logins
  // where the user still has the affiliate cookie set.
  const referralId = extractRewardfulReferralId(cookieHeader);
  if (referralId && data.user?.id) {
    const userMetadata = data.user.user_metadata ?? {};
    const displayName =
      typeof userMetadata.full_name === "string" && userMetadata.full_name.length > 0
        ? userMetadata.full_name
        : typeof userMetadata.name === "string" && userMetadata.name.length > 0
          ? userMetadata.name
          : null;
    await linkAffiliateReferralServerSide(
      data.user.id,
      data.user.email ?? null,
      displayName,
      referralId,
    );
  }

  const destination = getSafeRedirectPath(next, "/ask");
  const response = NextResponse.redirect(new URL(destination, origin));
  clearOAuthFlowCookie(response);
  clearAuthRedirectCookie(response);

  if (oauthFlow === "signup" && data.user?.id) {
    setRecentOauthSignupCookie(response, data.user.id);
  }

  return response;
}
