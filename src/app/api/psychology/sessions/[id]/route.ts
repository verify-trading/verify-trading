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

// Both verbs can call out to ElevenLabs for a transcript, which the platform default (15 s)
// would kill mid-flight — taking the abort below with it, so the fetch never even times out
// cleanly. 30 s leaves the 10 s fetch room to fail on its own terms.
export const maxDuration = 30;

const sessionIdParamSchema = z.uuid();

const sessionPatchSchema = z
  .object({
    // Optional so the client can report the conversation id the moment the call connects,
    // without a mid-call report overwriting the call clock a hang-up report already stored.
    durationSecs: z.number().int().min(0).max(86_400).optional(),
    // Realtime (ElevenLabs) calls report the conversation id so we can pull the transcript
    // server-side — there are no post-call webhooks in this design. Charset-bound, not just
    // length-bound: this value is client-supplied, is stored, and ends up in an ElevenLabs
    // URL, so nothing that could be a path segment or a percent-escape belongs in it.
    conversationId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,100}$/).optional(),
  })
  .refine((body) => body.durationSecs !== undefined || body.conversationId !== undefined);

type TranscriptTurn = { role?: string; message?: string | null };

type ConversationRecord = {
  status?: string;
  metadata?: { call_duration_secs?: number };
  transcript?: TranscriptTurn[];
  conversation_initiation_client_data?: { custom_llm_extra_body?: { vt_ctx?: unknown }; dynamic_variables?: { vt_ctx?: unknown } };
};

// "gone" (404) is kept distinct from a transient failure: it is the one answer that will never
// change, so it is the only one a caller may act on by dropping the stored pointer.
async function fetchConversation(conversationId: string, apiKey: string): Promise<ConversationRecord | "gone" | null> {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    logger.warn("ElevenLabs conversation fetch failed.", { status: response.status });
    return response.status === 404 ? "gone" : null;
  }
  return (await response.json()) as ConversationRecord;
}

// The stored conversation id is only a pointer, and it arrives from the client — so it is never
// trusted on its own. Every path that turns it into stored messages proves the conversation is
// this caller's first, via the signed vt_ctx ElevenLabs echoes back from token mint.
function bindsToCaller(
  conversation: ConversationRecord,
  secret: string,
  userId: string,
  sessionId: string,
): boolean {
  const init = conversation.conversation_initiation_client_data;
  const vtCtx = init?.custom_llm_extra_body?.vt_ctx ?? init?.dynamic_variables?.vt_ctx;
  // Expiry ignored on purpose: a repair can run days after the call, and the signature — not
  // freshness — is what proves whose transcript this is.
  const ctx = typeof vtCtx === "string" ? verifyAgentContext(vtCtx, secret, { ignoreExpiry: true }) : null;
  return Boolean(ctx && ctx.userId === userId && ctx.sessionId === sessionId);
}

// Remember which ElevenLabs conversation this session is, as early as we hear it. Never fatal
// and never behind a network call: this pointer is the only thing that makes a call repairable
// when the hang-up report is lost (app killed, signal gone), so it must land on its own.
async function linkConversation(supabase: SupabaseClient, userId: string, sessionId: string, conversationId: string) {
  const { error } = await supabase
    .from("psychology_sessions")
    .update({ elevenlabs_conversation_id: conversationId })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) logger.warn("Could not link the conversation for later repair.", { sessionId, error: error.message });
}

// Drop the pointer once the answer is final, so the repair below stops asking ElevenLabs the
// same question on every single open of the same call.
const clearConversationLink = (supabase: SupabaseClient, userId: string, sessionId: string) =>
  supabase
    .from("psychology_sessions")
    .update({ elevenlabs_conversation_id: null })
    .eq("id", sessionId)
    .eq("user_id", userId);

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
  // The session's own created_at. Deterministic on purpose — see the stamping note below.
  baseMs: number,
): Promise<number> {
  // One multi-row insert shares a single now() default, so every turn would carry an identical
  // created_at and the GET's created_at ordering would be arbitrary. Stamp them a millisecond
  // apart to keep the conversation in the order it was spoken.
  //
  // Stamped from the SESSION's created_at rather than Date.now() so the same transcript always
  // produces the same timestamps whoever stores it: that is what lets a unique index on
  // (session_id, created_at) actually catch the PATCH-store / GET-repair race below, which
  // check-then-insert alone can only narrow.
  const base = Number.isFinite(baseMs) ? baseMs : Date.now();
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
  // the transcript. This only narrows the window; the unique index in migration 31 closes it,
  // at which point the loser's insert simply errors and the next read shows the winner's rows.
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
  sessionCreatedAtMs: number,
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

  // Save the pointer FIRST, before anything that can fail. At hang-up ElevenLabs has usually not
  // attached the conversation's initiation data yet — the very thing carrying vt_ctx — so the bind
  // below simply cannot succeed on a fresh call. While this write sat after that check, every such
  // call threw the id away and stranded the session at 0 messages with nothing to retry from.
  // Storing it unverified is safe: bindsToCaller gates every path that turns it into messages.
  //
  // Never fatal either: the id only aids a LATER repair, so failing to save it must not cost us a
  // transcript we are already holding.
  await linkConversation(supabase, userId, sessionId, conversationId);

  const conversation = await fetchConversation(conversationId, apiKey);
  if (!conversation || conversation === "gone") return;

  if (!bindsToCaller(conversation, secret, userId, sessionId)) {
    // Expected on a fresh hang-up rather than an error: the id is saved, so the next read repairs.
    logger.warn("Conversation not bound yet; a later read will retry.", { sessionId });
    return;
  }

  await storeTurns(supabase, userId, sessionId, conversation, sessionCreatedAtMs);
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
      readMessages(session.supabase, session.user.id, parsed.data),
    ]);

    if (sessionQuery.error || messagesQuery.error || !messagesQuery.data) {
      return jsonApiError(500, "psychology_session_unavailable", "Could not load that coaching session right now.");
    }

    if (!sessionQuery.data) {
      return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
    }

    // A hang-up regularly beats ElevenLabs to attaching the conversation's initiation data, so the
    // PATCH could not bind it and the call reads as "Nothing was said". It did save the id, so ask
    // again here — and re-run the bind, because the id it saved was never verified. Self-healing:
    // a conversation that still is not ready stores 0 turns and the next read retries.
    // Terminal answers end the retry rather than repeating forever: a conversation ElevenLabs
    // no longer has, and a finished call that bound but had nothing to store, both drop the
    // stored pointer — after which this block never runs again for that session.
    let messages = messagesQuery.data as unknown as PsychologySessionMessageRow[];
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (messages.length === 0 && apiKey) {
      try {
        // Read the conversation id only on the repair path. Selecting it in the main query above
        // would make this route 500 for every session if the deploy landed before migration 30;
        // here a missing column simply errors, leaves conversationId undefined, and skips repair.
        const link = await session.supabase
          .from("psychology_sessions")
          .select("elevenlabs_conversation_id")
          .eq("user_id", session.user.id)
          .eq("id", parsed.data)
          .maybeSingle();
        const conversationId = (link.data as { elevenlabs_conversation_id?: string | null } | null)
          ?.elevenlabs_conversation_id;
        const secret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
        const conversation =
          conversationId && secret ? await fetchConversation(conversationId, apiKey) : null;
        const row = sessionQuery.data as unknown as PsychologySessionRow;

        if (conversation === "gone") {
          // The conversation does not exist any more (retention, or a junk id). Nothing will
          // ever come back from it, so stop paying for the same 404 on every open.
          await clearConversationLink(session.supabase, session.user.id, parsed.data);
        } else if (conversation && secret && bindsToCaller(conversation, secret, session.user.id, parsed.data)) {
          const stored = await storeTurns(
            session.supabase,
            session.user.id,
            parsed.data,
            conversation,
            Date.parse(row.created_at),
          );
          if (stored > 0) {
            const repaired = await readMessages(session.supabase, session.user.id, parsed.data);
            if (!repaired.error && repaired.data) {
              messages = repaired.data as unknown as PsychologySessionMessageRow[];
              // storeTurns updated message_count in the database, but this row was read before
              // that — without this the repaired call still renders as "0 messages".
              row.message_count = messages.length;
            }
          }
          // A hang-up report that never landed leaves the call at 0:00 even once its words are
          // recovered. ElevenLabs knows how long it ran, and it is bound to this caller here.
          const ran = Math.round(conversation.metadata?.call_duration_secs ?? 0);
          if (row.duration_secs === 0 && ran > 0) {
            await session.supabase
              .from("psychology_sessions")
              .update({ duration_secs: ran })
              .eq("id", parsed.data)
              .eq("user_id", session.user.id);
            row.duration_secs = ran;
          }
          // Finished with nothing to store: the call really was silent, so this is as repaired
          // as it will ever get. 0 stored turns is otherwise indistinguishable from "not ready".
          if (stored === 0 && (conversation.status === "done" || conversation.status === "failed")) {
            await clearConversationLink(session.supabase, session.user.id, parsed.data);
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
    // else's session indistinguishable from a missing one: zero rows -> 404. A report that
    // carries only the conversation id reads the row instead of writing it, so a mid-call
    // report can never roll the call clock back over a hang-up report that already landed.
    const { durationSecs, conversationId } = parsedBody.data;
    const table = session.supabase.from("psychology_sessions");
    const { data, error } = await (durationSecs === undefined
      ? table.select(PSYCHOLOGY_SESSION_COLUMNS)
      : table.update({ duration_secs: durationSecs }).select(PSYCHOLOGY_SESSION_COLUMNS))
      .eq("id", parsed.data)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      return jsonApiError(500, "psychology_session_update_failed", "Could not update that coaching session right now.");
    }

    if (!data) {
      return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
    }

    // Duration is saved; now (realtime calls only) pull and store the transcript. Failures here
    // are logged but don't fail the hang-up — the duration report already landed.
    //
    // A duration is what marks the call OVER. Without one this is a mid-call report, so it only
    // remembers the pointer: fetching a conversation that is still open returns a partial
    // transcript, and the idempotency guard would then latch that truncated version in forever.
    if (conversationId) {
      try {
        const row = data as unknown as PsychologySessionRow;
        if (durationSecs === undefined) {
          await linkConversation(session.supabase, session.user.id, parsed.data, conversationId);
        } else {
          await storeConversationTranscript(
            session.supabase,
            session.user.id,
            parsed.data,
            conversationId,
            Date.parse(row.created_at),
          );
        }
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
