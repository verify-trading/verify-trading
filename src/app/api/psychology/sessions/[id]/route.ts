import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  PSYCHOLOGY_SESSION_COLUMNS,
  toPsychologySession,
  toPsychologySessionMessage,
  type PsychologySessionMessageRow,
  type PsychologySessionRow,
} from "@/lib/psychology/sessions";

const sessionIdParamSchema = z.uuid();

const sessionPatchSchema = z.object({
  durationSecs: z.number().int().min(0).max(86_400),
});

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await context.params;
  const parsed = sessionIdParamSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonApiError(400, "psychology_session_invalid", "The coaching session id is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load coaching sessions.");
    }

    // Session row + its transcript are independent reads — fan them out. RLS scopes
    // both to the caller; the explicit user_id filters keep it explicit.
    const [sessionQuery, messagesQuery] = await Promise.all([
      session.supabase
        .from("psychology_sessions")
        .select(PSYCHOLOGY_SESSION_COLUMNS)
        .eq("user_id", session.user.id)
        .eq("id", parsed.data)
        .maybeSingle(),
      session.supabase
        .from("psychology_session_messages")
        .select("role, content, created_at")
        .eq("user_id", session.user.id)
        .eq("session_id", parsed.data)
        .order("created_at", { ascending: true })
        .limit(1000),
    ]);

    if (sessionQuery.error || messagesQuery.error || !messagesQuery.data) {
      return jsonApiError(500, "psychology_session_unavailable", "Could not load that coaching session right now.");
    }

    if (!sessionQuery.data) {
      return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
    }

    return NextResponse.json(
      {
        session: toPsychologySession(sessionQuery.data as unknown as PsychologySessionRow),
        messages: (messagesQuery.data as unknown as PsychologySessionMessageRow[]).map(toPsychologySessionMessage),
      },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology session request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_session_unavailable", "Could not load that coaching session right now.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await context.params;
  const parsed = sessionIdParamSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonApiError(400, "psychology_session_invalid", "The coaching session id is invalid.");
  }

  const parsedBody = sessionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return jsonApiError(400, "psychology_session_invalid", "The coaching session update is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to update coaching sessions.");
    }

    // The user_id filter + RLS (psychology_sessions_update_own) make updating someone
    // else's session indistinguishable from a missing one: zero rows -> 404.
    const { data, error } = await session.supabase
      .from("psychology_sessions")
      .update({ duration_secs: parsedBody.data.durationSecs })
      .eq("id", parsed.data)
      .eq("user_id", session.user.id)
      .select(PSYCHOLOGY_SESSION_COLUMNS)
      .maybeSingle();

    if (error) {
      return jsonApiError(500, "psychology_session_update_failed", "Could not update that coaching session right now.");
    }

    if (!data) {
      return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
    }

    return NextResponse.json(
      toPsychologySession(data as unknown as PsychologySessionRow),
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology session update failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_session_update_failed", "Could not update that coaching session right now.");
  }
}
