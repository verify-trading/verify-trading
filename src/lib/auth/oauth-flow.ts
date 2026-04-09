export type OAuthFlow = "login_only" | "signup";

export const OAUTH_FLOW_COOKIE_NAME = "vt_oauth_flow";
export const RECENT_OAUTH_SIGNUP_COOKIE_NAME = "vt_recent_oauth_signup";
export const OAUTH_FLOW_COOKIE_MAX_AGE_SECONDS = 10 * 60;
export const RECENT_OAUTH_SIGNUP_COOKIE_MAX_AGE_SECONDS = 10 * 60;

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
