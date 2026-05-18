/**
 * OAuth PKCE callback: `exchangeCodeForSession` must run on the server so session cookies are set.
 *
 * Google OAuth may create a user during sign-in. We intentionally allow that so
 * the login page can serve both returning Google users and first-time Google users.
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
import { ensureStripeCustomerForUser } from "@/lib/billing/repository";
import { logger } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
 * Silently fails, so OAuth redirects are not blocked by affiliate tracking.
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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const cookieHeader = request.headers.get("cookie");
  const code = searchParams.get("code");
  const next =
    searchParams.get("next") ?? readCookie(cookieHeader, AUTH_REDIRECT_COOKIE_NAME);
  const oauthFlow = parseOAuthFlow(
    readCookie(cookieHeader, OAUTH_FLOW_COOKIE_NAME) ?? searchParams.get("oauth"),
  );

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
