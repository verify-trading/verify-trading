import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";

type ProfileTierRow = {
  tier: string | null;
};

type MarketsAccess = { ok: true; userId: string } | { ok: false; response: NextResponse };

async function getMarketsSession() {
  const session = await getSessionUser();
  if (!session) {
    return { session: null, response: jsonUnauthorized("Sign in to view Markets.") } as const;
  }
  return { session, response: null } as const;
}

/**
 * Markets teaser access: any signed-in user. Used by the price snapshot route,
 * which is the free charts teaser. Pro-only data (intelligence, calendar) uses
 * requireMarketsProSession instead.
 */
export async function requireMarketsSession(): Promise<MarketsAccess> {
  const { session, response } = await getMarketsSession();
  if (!session) {
    return { ok: false, response };
  }
  return { ok: true, userId: session.user.id };
}

/**
 * Shared Markets API access: signed-in Pro users only.
 */
export async function requireMarketsProSession(): Promise<MarketsAccess> {
  const { session, response } = await getMarketsSession();
  if (!session) {
    return { ok: false, response };
  }

  const profileResult = await session.supabase
    .from("profiles")
    .select("tier")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      ok: false,
      response: jsonApiError(500, "markets_access_failed", profileResult.error.message),
    };
  }

  if (((profileResult.data as ProfileTierRow | null)?.tier ?? "free") !== "pro") {
    return {
      ok: false,
      response: jsonApiError(403, "pro_required", "Upgrade to Pro to unlock Markets."),
    };
  }

  return { ok: true, userId: session.user.id };
}

export const MARKETS_PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;
