/**
 * OAuth PKCE callback: `exchangeCodeForSession` must run on the server so session cookies are set.
 *
 * Login-only Google: when `oauth=login_only` (set only from /login), reject apparent new Google-only
 * signups after session exchange and delete the just-created auth user when admin cleanup is available
 * — see `shouldBlockLoginOnlyGoogleSignup` and `src/lib/auth/oauth-login-only.ts`.
 */
import { NextResponse } from "next/server";

import {
  OAUTH_FLOW_COOKIE_NAME,
  parseOAuthFlow,
  readCookie,
  RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  RECENT_OAUTH_SIGNUP_COOKIE_NAME,
} from "@/lib/auth/oauth-flow";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { shouldBlockLoginOnlyGoogleSignup } from "@/lib/auth/oauth-login-only";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOGIN_OAUTH_ERROR_CODE = "oauth_login_no_account";
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

function setRecentOauthSignupCookie(response: NextResponse, userId: string) {
  response.cookies.set(RECENT_OAUTH_SIGNUP_COOKIE_NAME, userId, {
    ...AUTH_COOKIE_OPTIONS,
    httpOnly: true,
    maxAge: RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS,
  });
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
  const next = searchParams.get("next");
  const oauthFlow = parseOAuthFlow(
    readCookie(cookieHeader, OAUTH_FLOW_COOKIE_NAME) ?? searchParams.get("oauth"),
  );
  const recentOauthSignupUserId = readCookie(cookieHeader, RECENT_OAUTH_SIGNUP_COOKIE_NAME);

  if (!code) {
    const response = NextResponse.redirect(new URL("/login?error=auth_code", origin));
    clearOAuthFlowCookie(response);
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
    clearOAuthFlowCookie(response);
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
    return response;
  }

  const destination = getSafeRedirectPath(next, "/ask");
  const response = NextResponse.redirect(new URL(destination, origin));
  clearOAuthFlowCookie(response);

  if (oauthFlow === "signup" && data.user?.id) {
    setRecentOauthSignupCookie(response, data.user.id);
  }

  return response;
}
