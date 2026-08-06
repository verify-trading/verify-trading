import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  countCallsToday,
  countMintsToday,
  DAILY_CALL_LIMIT,
  DAILY_MINT_LIMIT,
  loadCallTotals,
} from "@/lib/psychology/sessions";

// Every number the Mind header shows, counted server-side where the limit is enforced. Never
// derived from the sessions list: that list hides rows the cap counts, the device's midnight is
// not the server's, and it is a cache — each ends with the app promising a call the mint 429s.
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load coaching usage.");
    }

    const [callsToday, mintsToday, totals] = await Promise.all([
      countCallsToday(session.supabase, session.user.id),
      countMintsToday(session.supabase, session.user.id),
      loadCallTotals(session.supabase, session.user.id),
    ]);

    // Report whichever limit will actually refuse the next call: the mint backstop can bind
    // while callsToday is still low. Expressed as calls so the client keeps one meter.
    const mintHeadroom = Math.max(0, DAILY_MINT_LIMIT - mintsToday);
    const callHeadroom = Math.max(0, DAILY_CALL_LIMIT - callsToday);
    const used = mintHeadroom < callHeadroom ? DAILY_CALL_LIMIT - mintHeadroom : callsToday;

    return NextResponse.json(
      { callsToday: used, dailyLimit: DAILY_CALL_LIMIT, ...totals },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology usage request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_usage_unavailable", "Could not load your coaching usage right now.");
  }
}
