import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { verifyAgentContext } from "@/lib/psychology/agent-token";
import {
  insertSessionMessages,
  PSYCHOLOGY_SESSION_COLUMNS,
  toPsychologySession,
  toPsychologySessionMessage,
  type PsychologySessionMessageRow,
  type PsychologySessionRow,
} from "@/lib/psychology/sessions";

const sessionIdParamSchema = z.uuid();

const sessionPatchSchema = z.object({
  durationSecs: z.number().int().min(0).max(86_400),
  // Realtime (ElevenLabs) calls report the conversation id on hang-up so we can pull the
  // transcript server-side — there are no post-call webhooks in this design.
  conversationId: z.string().trim().min(1).max(200).optional(),
});

type TranscriptTurn = { role?: string; message?: string | null };

// Pull an ElevenLabs conversation transcript and store it as the same message rows the
// companion route writes. Idempotent (skips if the session already has messages) so a client
// retry never duplicates, and bound to the caller: the conversation's echoed vt_ctx must verify
// to this user + session, so a forged conversationId can't pull someone else's transcript in.
async function storeConversationTranscript(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  conversationId: string,
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const secret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
  if (!apiKey || !secret) return;

  const existing = await supabase
    .from("psychology_session_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .limit(1);
  if (existing.error) throw new Error(`transcript idempotency check failed: ${existing.error.message}`);
  if ((existing.data?.length ?? 0) > 0) return; // already stored

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.warn("ElevenLabs conversation fetch failed.", { status: response.status });
    return;
  }

  const conversation = (await response.json()) as {
    transcript?: TranscriptTurn[];
    conversation_initiation_client_data?: { custom_llm_extra_body?: { vt_ctx?: unknown }; dynamic_variables?: { vt_ctx?: unknown } };
  };

  // Bind the conversation to the caller via the signed context we planted at token mint.
  const init = conversation.conversation_initiation_client_data;
  const vtCtx = init?.custom_llm_extra_body?.vt_ctx ?? init?.dynamic_variables?.vt_ctx;
  const ctx = typeof vtCtx === "string" ? verifyAgentContext(vtCtx, secret) : null;
  if (!ctx || ctx.userId !== userId || ctx.sessionId !== sessionId) {
    logger.warn("Conversation transcript rejected: context did not bind to the caller.", { sessionId });
    return;
  }

  // One multi-row insert shares a single now() default, so every turn would carry an identical
  // created_at and the GET's created_at ordering would be arbitrary. Stamp them a millisecond
  // apart to keep the conversation in the order it was spoken.
  const base = Date.now();
  const rows = (conversation.transcript ?? [])
    .filter((turn) => (turn.role === "user" || turn.role === "agent") && typeof turn.message === "string" && turn.message.trim())
    .map((turn, index) => ({
      session_id: sessionId,
      user_id: userId,
      role: (turn.role === "agent" ? "coach" : "user") as "user" | "coach",
      content: (turn.message as string).trim(),
      created_at: new Date(base + index).toISOString(),
    }));
  if (rows.length === 0) return;

  // Count first, then insert. The reverse order meant a failed count update left stored
  // messages the list route couldn't see, which the idempotency check above then refused to
  // repair on retry. This way a failure leaves a visible row a retry can still fill in.
  const updated = await supabase
    .from("psychology_sessions")
    .update({ message_count: rows.length })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (updated.error) throw new Error(`message_count update failed: ${updated.error.message}`);

  await insertSessionMessages(supabase, rows);
}

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

    // Duration is saved; now (realtime calls only) pull and store the transcript. Failures here
    // are logged but don't fail the hang-up — the duration report already landed.
    if (parsedBody.data.conversationId) {
      try {
        await storeConversationTranscript(session.supabase, session.user.id, parsed.data, parsedBody.data.conversationId);
      } catch (error) {
        logger.error("Storing conversation transcript failed.", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
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
