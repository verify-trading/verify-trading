import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";

type ProfileTierRow = {
  tier: string | null;
};

/**
 * Shared Markets API access: signed-in Pro users only (same as `/api/markets`).
 */
export async function requireMarketsProSession(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSessionUser();

  if (!session) {
    return { ok: false, response: jsonUnauthorized("Sign in to view Markets.") };
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
