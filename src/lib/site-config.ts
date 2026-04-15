/**
 * Public app branding and copy. Set via NEXT_PUBLIC_* env vars (Vercel → Environment Variables).
 * Defaults preserve the original product name for local dev.
 */

const DEFAULT_APP_NAME = "verify.trading";

export function getAppName(): string {
  const raw = process.env.NEXT_PUBLIC_APP_NAME?.trim();
  return raw || DEFAULT_APP_NAME;
}

export function getSiteTitle(): string {
  const t = process.env.NEXT_PUBLIC_SITE_TITLE?.trim();
  if (t) {
    return t;
  }
  return `${getAppName()} — Ask for traders`;
}

export function getSiteDescription(): string {
  const d = process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim();
  if (d) {
    return d;
  }
  return "Broker checks, market briefings, position sizing, charts, and projections — structured answers for retail traders.";
}

export function getOnboardingCallUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ONBOARDING_CALL_URL?.trim();
  return raw || null;
}

/** Prefer `NEXT_PUBLIC_TRADER_SUPPORT_CALL_URL`; falls back to onboarding booking URL. */
export function getTraderSupportCallUrl(): string | null {
  const dedicated = process.env.NEXT_PUBLIC_TRADER_SUPPORT_CALL_URL?.trim();
  if (dedicated) {
    return dedicated;
  }
  return getOnboardingCallUrl();
}

export function getTelegramCommunityUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_COMMUNITY_URL?.trim();
  return raw || null;
}

/** Injects {{APP_NAME}} in prompt templates. */
export function expandPromptTemplate(template: string): string {
  return template.replace(/\{\{APP_NAME\}\}/g, getAppName());
}
