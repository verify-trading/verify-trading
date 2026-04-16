import { getSafeRedirectPath } from "@/lib/auth/safe-redirect";

export type OAuthFlow = "login_only" | "signup";

export const OAUTH_FLOW_COOKIE_NAME = "vt_oauth_flow";
/** Short-lived post-login path if `next` is missing from `/auth/callback` query (some OAuth flows strip it). */
export const AUTH_REDIRECT_COOKIE_NAME = "vt_auth_redirect";
export const RECENT_OAUTH_SIGNUP_COOKIE_NAME = "vt_recent_oauth_signup";
export const OAUTH_FLOW_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const AUTH_REDIRECT_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Persists a safe in-app path before OAuth so `/auth/callback` can redirect even when `next`
 * is missing from the URL after the IdP round-trip.
 */
export function setAuthRedirectCookie(path: string) {
  if (typeof document === "undefined") {
    return;
  }
  const safe = getSafeRedirectPath(path, "");
  if (!safe) {
    return;
  }
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${AUTH_REDIRECT_COOKIE_NAME}=${encodeURIComponent(safe)}; Path=/; Max-Age=${AUTH_REDIRECT_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax` +
    secure;
}

export function beginOAuthFlow(flow: OAuthFlow) {
  if (typeof document === "undefined") {
    return;
  }

  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${OAUTH_FLOW_COOKIE_NAME}=${flow}; Path=/; Max-Age=${OAUTH_FLOW_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax` +
    secure;
}

export function parseOAuthFlow(value: string | null | undefined): OAuthFlow | null {
  return value === "login_only" || value === "signup" ? value : null;
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    const value = trimmed.slice(separatorIndex + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}
