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
  UNIQUE_VIOLATION,
  type PsychologySessionMessageRow,
  type PsychologySessionRow,
} from "@/lib/psychology/sessions";

// Both verbs fetch transcripts from ElevenLabs; the platform default (15 s) killed the
// function before the 10 s fetch could abort cleanly.
export const maxDuration = 30;

const sessionIdParamSchema = z.uuid();

const sessionPatchSchema = z
  .object({
    // Optional so a mid-call report can send only the conversation id, without overwriting a
    // call clock a hang-up report already stored.
    durationSecs: z.number().int().min(0).max(86_400).optional(),
    // Charset-bound, not just length-bound: client-supplied, stored, and interpolated into an
    // ElevenLabs URL, so nothing that could be a path segment or percent-escape belongs in it.
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

// "gone" (404) is distinct from a transient failure: it is the only answer that will never
// change, so the only one a caller may act on by dropping the stored pointer.
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

// A call whose transcript is not final. Importing one latches a PREFIX in permanently, because
// the idempotency guards below read "already has messages" as "done". ElevenLabs status is
// initiated | in-progress | processing | done | failed; "processing" still serves a partial
// transcript, so only done/failed are final.
// Unknown or missing status still imports, so a new ElevenLabs enum value cannot silently stop
// every transcript from being stored.
const isLiveCall = (conversation: ConversationRecord): boolean =>
  conversation.status === "initiated" ||
  conversation.status === "in-progress" ||
  conversation.status === "processing";

// The conversation id arrives from the client, so it is never trusted on its own: every path
// that turns it into stored messages first proves the conversation is this caller's, via the
// signed vt_ctx ElevenLabs echoes back from token mint.
function bindsToCaller(
  conversation: ConversationRecord,
  secret: string,
  userId: string,
  sessionId: string,
): boolean {
  const init = conversation.conversation_initiation_client_data;
  const vtCtx = init?.custom_llm_extra_body?.vt_ctx ?? init?.dynamic_variables?.vt_ctx;
  // Expiry ignored: a repair can run days later, and the signature proves whose transcript
  // this is, not freshness.
  const ctx = typeof vtCtx === "string" ? verifyAgentContext(vtCtx, secret, { ignoreExpiry: true }) : null;
  return Boolean(ctx && ctx.userId === userId && ctx.sessionId === sessionId);
}

// Never fatal and never behind a network call: this pointer is the only thing that makes a
// call repairable when the hang-up report is lost (app killed, signal gone).
async function linkConversation(supabase: SupabaseClient, userId: string, sessionId: string, conversationId: string) {
  const { error } = await supabase
    .from("psychology_sessions")
    .update({ elevenlabs_conversation_id: conversationId })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) logger.warn("Could not link the conversation for later repair.", { sessionId, error: error.message });
}

// Dropped once the answer is final, so the repair stops re-asking ElevenLabs on every open.
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

// Caller must have bound the conversation to this user + session. Returns turns stored; 0
// means ElevenLabs has not finalised the transcript, which the next read retries.
async function storeTurns(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  conversation: ConversationRecord,
  baseMs: number,
): Promise<number> {
  // Guarded here, not per caller: both the PATCH and the GET repair import through this, and a
  // transcript stored mid-call can never be corrected.
  if (isLiveCall(conversation)) return 0;

  // One multi-row insert shares a single now(), leaving created_at ordering arbitrary — so
  // stamp turns a millisecond apart. Based on the SESSION's created_at, not Date.now(), so the
  // same transcript yields the same timestamps whoever stores it; that is what lets the unique
  // index on (session_id, created_at) catch the PATCH/GET race below.
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

  // Re-checked right before writing, not just in the PATCH caller: GET repairs too, and two
  // overlapping reads would both insert. Only narrows the window; migration 31's unique index
  // closes it.
  const already = await supabase
    .from("psychology_session_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .limit(1);
  if (already.error) throw new Error(`transcript idempotency check failed: ${already.error.message}`);
  if ((already.data?.length ?? 0) > 0) return 0;

  // Count first, then insert. The reverse order left stored messages the list route couldn't
  // see, which the idempotency check then refused to repair on retry.
  const updated = await supabase
    .from("psychology_sessions")
    .update({ message_count: rows.length })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (updated.error) throw new Error(`message_count update failed: ${updated.error.message}`);

  // Losing the migration-31 race is expected, not a failure: the winner stored this exact
  // transcript under the same deterministic timestamps. Only a unique violation is swallowed.
  try {
    await insertSessionMessages(supabase, rows);
  } catch (error) {
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
    logger.info("Transcript was stored by a concurrent writer; keeping theirs.", { sessionId });
    return 0;
  }
  return rows.length;
}

// Idempotent, so a client retry never duplicates. Bound to the caller: the echoed vt_ctx must
// verify to this user + session, so a forged conversationId can't pull in someone else's
// transcript. Returns turns stored this call.
async function storeConversationTranscript(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  conversationId: string,
  sessionCreatedAtMs: number,
): Promise<number> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const secret = process.env.ELEVENLABS_AGENT_LLM_SECRET;
  if (!apiKey || !secret) return 0;

  const existing = await supabase
    .from("psychology_session_messages")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .limit(1);
  if (existing.error) throw new Error(`transcript idempotency check failed: ${existing.error.message}`);
  if ((existing.data?.length ?? 0) > 0) return 0; // already stored

  // Save the pointer FIRST, before anything that can fail. At hang-up ElevenLabs usually has
  // not attached the initiation data carrying vt_ctx, so the bind below cannot succeed yet;
  // while this write sat after that check, every such call discarded the id and stranded the
  // session at 0 messages with nothing to retry from. Storing it unverified is safe —
  // bindsToCaller gates every path that turns it into messages. Never fatal.
  await linkConversation(supabase, userId, sessionId, conversationId);

  // The initiation data carrying vt_ctx lands a moment AFTER the call ends, so the first read
  // at hang-up routinely cannot bind. Retrying stores the transcript while the trader is still
  // on the screen; otherwise the list says "0 messages" until someone opens that call.
  // Waits on BOTH conditions, not just the bind: a still-"processing" conversation would latch
  // a prefix. Exhausting the ladder is fine — the pointer is saved and the next GET repairs.
  const deadline = Date.now() + 12_000;
  const ready = (record: ConversationRecord) =>
    !isLiveCall(record) && bindsToCaller(record, secret, userId, sessionId);
  let conversation = await fetchConversation(conversationId, apiKey);
  for (const wait of [1_500, 3_000, 5_000]) {
    if (conversation === "gone") return 0;
    if (conversation && ready(conversation)) break;
    if (Date.now() + wait > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, wait));
    conversation = await fetchConversation(conversationId, apiKey);
  }
  if (!conversation || conversation === "gone") return 0;

  if (!ready(conversation)) {
    // The pointer is saved, so the next read repairs it.
    logger.warn("Conversation not ready yet; a later read will retry.", { sessionId });
    return 0;
  }

  return storeTurns(supabase, userId, sessionId, conversation, sessionCreatedAtMs);
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

    // RLS scopes both reads to the caller; the user_id filters keep it explicit.
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

    // Lazy repair for a call the PATCH could not bind, which otherwise reads as "Nothing was
    // said". The bind is re-run here because the saved id was never verified. A conversation
    // that still is not ready stores 0 turns and the next read retries; terminal answers drop
    // the pointer so this block never runs again for that session.
    let messages = messagesQuery.data as unknown as PsychologySessionMessageRow[];
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (messages.length === 0 && apiKey) {
      try {
        // Read only on the repair path: selecting it in the main query would 500 every session
        // if the deploy landed before migration 30. Here a missing column just skips repair.
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
          // Gone for good (retention, or a junk id) — stop paying for the same 404 every open.
          await clearConversationLink(session.supabase, session.user.id, parsed.data);
        } else if (
          conversation &&
          secret &&
          // Neither the transcript nor the clock below is final mid-call, and a stored mid-call
          // duration is made permanent by the "never overwrite a reported duration" rule.
          !isLiveCall(conversation) &&
          bindsToCaller(conversation, secret, session.user.id, parsed.data)
        ) {
          await storeTurns(
            session.supabase,
            session.user.id,
            parsed.data,
            conversation,
            Date.parse(row.created_at),
          );
          // Re-read on ANY completed attempt, not only when this request did the writing: a
          // storeTurns of 0 also means a concurrent repair won the race. Gating on our own row
          // count showed "Nothing was said on this call." for a fully recovered call.
          const repaired = await readMessages(session.supabase, session.user.id, parsed.data);
          if (!repaired.error && repaired.data && repaired.data.length > 0) {
            messages = repaired.data as unknown as PsychologySessionMessageRow[];
            // This row was read before storeTurns updated message_count; without the patch the
            // repaired call still renders as "0 messages".
            row.message_count = messages.length;
          }
          // A hang-up report that never landed leaves the call at 0:00 forever, so take
          // ElevenLabs' clock. Bounded like the client-reported duration (sessionPatchSchema):
          // third-party input, same column. Only fills a call with no duration of its own.
          const reported = conversation.metadata?.call_duration_secs;
          const ran = typeof reported === "number" && Number.isFinite(reported)
            ? Math.min(86_400, Math.max(0, Math.round(reported)))
            : 0;
          if (!row.duration_secs && ran > 0) {
            await session.supabase
              .from("psychology_sessions")
              .update({ duration_secs: ran })
              .eq("id", parsed.data)
              .eq("user_id", session.user.id);
            row.duration_secs = ran;
          }
          // Finished with nothing to store: the call really was silent. Keyed off the messages
          // that now exist, not what THIS request wrote — a race loser wrote nothing but the
          // transcript is there, and dropping the pointer for it would be wrong.
          if (messages.length === 0 && (conversation.status === "done" || conversation.status === "failed")) {
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

    // The user_id filter + RLS (psychology_sessions_update_own) make updating someone else's
    // session indistinguishable from a missing one: zero rows -> 404. A report carrying only
    // the conversation id reads instead of writes, so it can't roll back a reported clock.
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

    // Transcript failures are logged but don't fail the hang-up; the duration already landed.
    // A duration marks the call OVER — without one this is a mid-call report, which only
    // remembers the pointer, since importing an open conversation latches a partial transcript.
    const row = data as unknown as PsychologySessionRow;
    let imported = 0;
    if (conversationId) {
      try {
        if (durationSecs === undefined) {
          await linkConversation(session.supabase, session.user.id, parsed.data, conversationId);
        } else {
          imported = await storeConversationTranscript(
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

    // `row` was read BEFORE the import, so it still says 0 messages — and this response is what
    // the client renders the instant the trader hangs up. Patch in the count that just landed
    // rather than paying for a second read. Importing 0 needs no patch: nothing was stored, or
    // a concurrent writer won the race and the next read shows their rows.
    return NextResponse.json(
      toPsychologySession(imported > 0 ? { ...row, message_count: imported } : row),
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology session update failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_session_update_failed", "Could not update that coaching session right now.");
  }
}
