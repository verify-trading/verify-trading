/**
 * Public app branding and copy. Set via NEXT_PUBLIC_* env vars (Vercel → Environment Variables).
 * Defaults preserve the original product name for local dev.
 */

const DEFAULT_APP_NAME = "verify.trading";
const DEFAULT_SITE_URL = "https://www.verify.trading";

export function getAppName(): string {
  const raw = process.env.NEXT_PUBLIC_APP_NAME?.trim();
  return raw || DEFAULT_APP_NAME;
}

/** Canonical site origin (no trailing slash). Set via NEXT_PUBLIC_SITE_URL for preview/staging deploys. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw || DEFAULT_SITE_URL).replace(/\/$/, "");
}

export function getSiteTitle(): string {
  const t = process.env.NEXT_PUBLIC_SITE_TITLE?.trim();
  if (t) {
    return t;
  }
  return `${getAppName()} — Verify Before You Trade`;
}

export function getSiteDescription(): string {
  const d = process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim();
  if (d) {
    return d;
  }
  return "Broker checks, market briefings, position sizing, charts, and projections — structured answers for retail traders.";
}

/** Injects {{APP_NAME}} in prompt templates. */
export function expandPromptTemplate(template: string): string {
  return template.replace(/\{\{APP_NAME\}\}/g, getAppName());
}

/** Public store listings for the mobile app. */
export const STORE_URLS = {
  apple: "https://apps.apple.com/app/id6792117065",
  googlePlay: "https://play.google.com/store/apps/details?id=trading.verify.mobile",
} as const;

/** Footer social profiles. `#` = placeholder until the client supplies the real URL (not rendered). */
export const SOCIAL_URLS = {
  instagram: "https://www.instagram.com/verify.tradingapp",
  facebook: "https://www.facebook.com/share/1C9GPUjAvV/",
  tiktok: "#",
  linkedin: "https://www.linkedin.com/company/verifytrading/",
  youtube: "https://youtube.com/@verify.trading",
} as const;
