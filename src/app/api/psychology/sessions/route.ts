import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  PSYCHOLOGY_SESSION_COLUMNS,
  REAL_CALL_FILTER,
  toPsychologySession,
  type PsychologySessionRow,
} from "@/lib/psychology/sessions";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load coaching sessions.");
    }

    const { data, error } = await session.supabase
      .from("psychology_sessions")
      .select(PSYCHOLOGY_SESSION_COLUMNS)
      .eq("user_id", session.user.id)
      // A real call must stay listed even when its transcript never stored, so a stored
      // conversation id counts as proof it happened — the only proof left when the hang-up
      // report never arrives, and opening the call is what triggers the repair in GET [id].
      // Shared with the daily-limit count so history and allowance agree on which rows are
      // calls. A session minted but never connected has no pointer, so it stays hidden.
      .or(REAL_CALL_FILTER)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      // Explicit cap; newest-first ordering means the oldest calls fall off.
      .limit(200);

    if (error || !data) {
      return jsonApiError(500, "psychology_sessions_unavailable", "Could not load coaching sessions right now.");
    }

    return NextResponse.json(
      (data as unknown as PsychologySessionRow[]).map(toPsychologySession),
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology sessions request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_sessions_unavailable", "Could not load coaching sessions right now.");
  }
}
