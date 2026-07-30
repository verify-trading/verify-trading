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

type ConversationRecord = {
  transcript?: TranscriptTurn[];
  conversation_initiation_client_data?: { custom_llm_extra_body?: { vt_ctx?: unknown }; dynamic_variables?: { vt_ctx?: unknown } };
};

async function fetchConversation(conversationId: string, apiKey: string): Promise<ConversationRecord | null> {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.warn("ElevenLabs conversation fetch failed.", { status: response.status });
    return null;
  }
  return (await response.json()) as ConversationRecord;
}

const readMessages = (supabase: SupabaseClient, userId: string, sessionId: string) =>
  supabase
    .from("psychology_session_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(1000);

// Store the spoken turns as message rows. The conversation must already be bound to this user +
// session by the caller. Returns how many turns were stored — 0 means ElevenLabs has not
// finalised the transcript yet, which the next read retries.
async function storeTurns(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  conversation: ConversationRecord,
): Promise<number> {
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
  if (rows.length === 0) return 0;

  // Re-check right before writing, not just in the PATCH caller: GET repairs too, and two
  // overlapping reads of an empty session would otherwise both fetch and both insert, doubling
  // the transcript. ponytail: narrows the window rather than closing it — a unique constraint on
  // (session_id, created_at) is the real fix if duplicates ever appear.
  const already = await supabase
    .from("psychology_session_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .limit(1);
  if (already.error) throw new Error(`transcript idempotency check failed: ${already.error.message}`);
  if ((already.data?.length ?? 0) > 0) return 0;

  // Count first, then insert. The reverse order meant a failed count update left stored
  // messages the list route couldn't see, which the idempotency check then refused to
  // repair on retry. This way a failure leaves a visible row a retry can still fill in.
  const updated = await supabase
    .from("psychology_sessions")
    .update({ message_count: rows.length })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (updated.error) throw new Error(`message_count update failed: ${updated.error.message}`);

  await insertSessionMessages(supabase, rows);
  return rows.length;
}

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

  const conversation = await fetchConversation(conversationId, apiKey);
  if (!conversation) return;

  // Bind the conversation to the caller via the signed context we planted at token mint.
  const init = conversation.conversation_initiation_client_data;
  const vtCtx = init?.custom_llm_extra_body?.vt_ctx ?? init?.dynamic_variables?.vt_ctx;
  const ctx = typeof vtCtx === "string" ? verifyAgentContext(vtCtx, secret) : null;
  if (!ctx || ctx.userId !== userId || ctx.sessionId !== sessionId) {
    logger.warn("Conversation transcript rejected: context did not bind to the caller.", { sessionId });
    return;
  }

  // Persist the id BEFORE storing turns, and only now that the bind check has passed so a forged
  // id can never be written. ElevenLabs usually has not finalised the transcript by hang-up; this
  // id used to be discarded right here, which stranded the session at 0 messages forever because
  // nothing remembered which conversation to ask about. GET refetches with it.
  const linked = await supabase
    .from("psychology_sessions")
    .update({ elevenlabs_conversation_id: conversationId })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (linked.error) throw new Error(`conversation link failed: ${linked.error.message}`);

  await storeTurns(supabase, userId, sessionId, conversation);
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
        .select(`${PSYCHOLOGY_SESSION_COLUMNS}, elevenlabs_conversation_id`)
        .eq("user_id", session.user.id)
        .eq("id", parsed.data)
        .maybeSingle(),
      readMessages(session.supabase, session.user.id, parsed.data),
    ]);

    if (sessionQuery.error || messagesQuery.error || !messagesQuery.data) {
      return jsonApiError(500, "psychology_session_unavailable", "Could not load that coaching session right now.");
    }

    if (!sessionQuery.data) {
      return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
    }

    // A hang-up regularly beats ElevenLabs to finalising the transcript, so the PATCH stored
    // nothing and the call reads as "Nothing was said". The conversation id it saved lets us ask
    // again here — bind already verified when it was stored, so no re-check is needed. Self-
    // healing: a still-unfinalised conversation just stores 0 turns and the next read retries.
    // ponytail: a genuinely silent call refetches on every open, since 0 turns is also the
    // "not ready" signal. One request per open of an empty session; add an attempted-at stamp
    // only if that ever shows up in the ElevenLabs bill.
    let messages = messagesQuery.data as unknown as PsychologySessionMessageRow[];
    const { elevenlabs_conversation_id: conversationId } = sessionQuery.data as {
      elevenlabs_conversation_id?: string | null;
    };
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (messages.length === 0 && conversationId && apiKey) {
      try {
        const conversation = await fetchConversation(conversationId, apiKey);
        if (conversation && (await storeTurns(session.supabase, session.user.id, parsed.data, conversation)) > 0) {
          const repaired = await readMessages(session.supabase, session.user.id, parsed.data);
          if (!repaired.error && repaired.data) {
            messages = repaired.data as unknown as PsychologySessionMessageRow[];
            // storeTurns updated message_count in the database, but this row was read before
            // that — without this the repaired call still renders as "0 messages".
            (sessionQuery.data as { message_count: number }).message_count = messages.length;
          }
        }
      } catch (error) {
        // A failed repair must never break loading the session — it stays empty and retries.
        logger.warn("Transcript backfill failed.", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return NextResponse.json(
      {
        session: toPsychologySession(sessionQuery.data as unknown as PsychologySessionRow),
        messages: messages.map(toPsychologySessionMessage),
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
