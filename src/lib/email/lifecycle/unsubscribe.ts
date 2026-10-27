import { createHmac, timingSafeEqual } from "node:crypto";

import { readOptionalEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site-config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Links are signed with CRON_SECRET (already set wherever the cron runs) rather than a dedicated
 * env var. The "unsubscribe:" prefix keeps these HMACs separate from any other use of the secret.
 * Rotating CRON_SECRET invalidates unsubscribe links in emails already sent.
 */
function getSecret(): string | null {
  return readOptionalEnv("CRON_SECRET");
}

/** False when CRON_SECRET is unset: no unsubscribe link can be signed. */
export function canSignUnsubscribe(): boolean {
  return getSecret() !== null;
}

function hmac(secret: string, userId: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url");
}

/** Throws when the secret is unset, so sending code can never put an unsigned link in an email. */
export function signUnsubscribeToken(userId: string): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("CRON_SECRET is not set; cannot sign unsubscribe links.");
  }
  return hmac(secret, userId);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const secret = getSecret();
  if (!secret || !UUID_PATTERN.test(userId) || !token) {
    return false;
  }
  const expected = Buffer.from(hmac(secret, userId));
  const actual = Buffer.from(token);
  // timingSafeEqual throws on unequal lengths; the HMAC length is public, so this check leaks nothing.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function buildUnsubscribeUrl(userId: string): string {
  const params = new URLSearchParams({ u: userId, t: signUnsubscribeToken(userId) });
  return `${getSiteUrl()}/api/email/unsubscribe?${params.toString()}`;
}
