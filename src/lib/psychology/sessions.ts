// Row shapes and API mappers for psychology voice-call sessions and their transcripts
// (tables: psychology_sessions + psychology_session_messages). The mobile client is
// built against the camelCase shapes below — keep them stable.

import type { SupabaseClient } from "@supabase/supabase-js";

import { getTodayUtcDateString } from "@/lib/rate-limit/usage";

/** Coaching calls are rationed per UTC day — each connected call bills ElevenLabs + our LLM.
 *  The number the app shows and the number the mint enforces are the same one: the client
 *  reads it back from /api/psychology/usage instead of counting its own list. */
export const DAILY_CALL_LIMIT = 5;

export const DAILY_LIMIT_MESSAGE = `You've used today's ${DAILY_CALL_LIMIT} coaching calls. They reset at midnight UTC.`;

// What counts as a call that actually happened, as a PostgREST `or` filter. A session row is
// opened at token mint, so without this a mint that never connected (screen backed out of, a
// dead network) would burn a call the trader never had. Deliberately the same predicate the
// list route filters by: the meter, the history and the cap must agree on which rows are calls.
export const REAL_CALL_FILTER = "message_count.gt.0,duration_secs.gt.0,elevenlabs_conversation_id.not.is.null";

/** Today's real calls, on the UTC day the limit resets on. One definition, two callers — the
 *  429 in realtime-token and the number /api/psychology/usage renders — so the UI can never
 *  offer a call the enforcement is about to refuse. Throws rather than returning a guess: a
 *  spend limit that fails open is not a limit. */
export async function countCallsToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("psychology_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${getTodayUtcDateString()}T00:00:00.000Z`)
    .or(REAL_CALL_FILTER);
  if (error || count === null || count === undefined) {
    throw new Error(`psychology_sessions count failed: ${error?.message ?? "no count"}`);
  }
  return count;
}

/** Lifetime minutes + calls for the Mind header. Display-only — nothing is enforced on these,
 *  which is why they stay a second read instead of making every token mint pay for the
 *  trader's whole history. */
export async function loadCallTotals(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ callsTotal: number; minutesTotal: number }> {
  const { data, error } = await supabase
    .from("psychology_sessions")
    .select("duration_secs")
    .eq("user_id", userId)
    .or(REAL_CALL_FILTER)
    // Explicit cap (PostgREST would silently apply ~1000 anyway). At 5 calls a day this is
    // years of history, and a total that stops at a number we chose beats one that stops
    // wherever the platform default happens to sit.
    .limit(5000);
  if (error || !data) throw new Error(`psychology_sessions totals failed: ${error?.message ?? "no rows"}`);

  const rows = data as unknown as Array<{ duration_secs: number | null }>;
  const secs = rows.reduce((total, row) => total + Math.max(0, row.duration_secs ?? 0), 0);
  return { callsTotal: rows.length, minutesTotal: Math.floor(secs / 60) };
}

// Opens a fresh voice-call session row (message_count 0). Both the turn-based companion and
// the realtime-token route start a call exactly this way. Throws on failure.
export async function openCoachSession(
  supabase: SupabaseClient,
  userId: string,
  assessmentId: string,
): Promise<{ id: string; message_count: number }> {
  const { data, error } = await supabase
    .from("psychology_sessions")
    .insert({ user_id: userId, assessment_id: assessmentId, message_count: 0, break_recommended: false })
    .select("id, message_count")
    .single();
  if (error || !data) throw new Error(`psychology_sessions insert failed: ${error?.message ?? "no row"}`);
  return data as { id: string; message_count: number };
}

// Batch-inserts transcript rows. On the session-aware paths persistence IS the feature, so
// these writes must succeed before the route responds — a failure throws into the caller's
// catch and surfaces as a retryable 500. Callers own their own message_count bookkeeping.
export async function insertSessionMessages(
  supabase: SupabaseClient,
  // created_at is optional: the transcript importer stamps it per row so a batch insert keeps
  // the spoken order, while single-message writers let the column default.
  rows: Array<{ session_id: string; user_id: string; role: "user" | "coach"; content: string; created_at?: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("psychology_session_messages").insert(rows);
  if (error) throw new Error(`psychology_session_messages insert failed: ${error.message}`);
}

export type PsychologySessionRow = {
  id: string;
  created_at: string;
  duration_secs: number;
  message_count: number;
  break_recommended: boolean;
  assessment_id: string | null;
};

export type PsychologySessionMessageRow = {
  role: "user" | "coach";
  content: string;
  created_at: string;
};

export const PSYCHOLOGY_SESSION_COLUMNS =
  "id, created_at, duration_secs, message_count, break_recommended, assessment_id";

export function toPsychologySession(row: PsychologySessionRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    durationSecs: row.duration_secs,
    messageCount: row.message_count,
    breakRecommended: row.break_recommended,
    assessmentId: row.assessment_id,
  };
}

export function toPsychologySessionMessage(row: PsychologySessionMessageRow) {
  return {
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}
