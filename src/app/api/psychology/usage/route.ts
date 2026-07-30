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

// Every number the Mind header shows, computed where the limit is enforced.
//
// A separate endpoint rather than extra fields on GET /sessions: that route answers with a bare
// JSON array, so there is nowhere to put them without breaking every client already parsing it.
//
// It exists because the client cannot derive these correctly. Counting the sessions list gives a
// different answer three ways — the list hides rows the cap counts, the device's midnight is not
// the server's, and the list is a cache — and every one of them ends with the app promising a
// call that the mint then refuses with a 429.
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

    // Report whichever limit will actually refuse the next call. The mint backstop can bind
    // while callsToday is still low — that is exactly the trader whose calls go unreported —
    // and reporting only the allowance would show them calls remaining that the mint then
    // 429s, which is the disagreement this endpoint exists to prevent. Expressed as calls so
    // the client keeps one meter: when the backstop is the tighter of the two, its remaining
    // headroom is what the meter counts down.
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
