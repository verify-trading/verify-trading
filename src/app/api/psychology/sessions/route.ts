import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  PSYCHOLOGY_SESSION_COLUMNS,
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
      // Hides the legacy contentless log rows, but a real call must still be listed even when
      // its transcript never stored (ElevenLabs slow to finalise, fetch failed, empty
      // transcript) — otherwise the trader's call silently disappears from their history.
      //
      // A stored conversation id counts as proof the call happened, and is the ONLY proof left
      // when the hang-up report never arrives (app killed, signal gone): the row then carries
      // no duration and no messages, and without this clause the trader could not open it —
      // which is also the only thing that triggers the transcript repair in GET [id].
      // A session that was minted but never connected has no pointer, so it stays hidden.
      .or("message_count.gt.0,duration_secs.gt.0,elevenlabs_conversation_id.not.is.null")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      // Explicit cap (PostgREST would silently apply ~1000 anyway); newest-first
      // ordering means it's the oldest calls that fall off.
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
