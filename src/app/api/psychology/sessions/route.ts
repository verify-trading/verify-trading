import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  PSYCHOLOGY_SESSION_COLUMNS,
  toPsychologySession,
  type PsychologySessionRow,
} from "@/lib/psychology/sessions";

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

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
      .or("message_count.gt.0,duration_secs.gt.0")
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
