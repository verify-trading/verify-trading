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

/** Said when the mint backstop is what refused, not the allowance. It must not claim the five
 *  calls were used: the trader who hits this is precisely the one whose calls were never
 *  reported, so their meter reads under the limit and the other message would contradict the
 *  screen they are looking at. */
export const MINT_LIMIT_MESSAGE = "Too many calls started today. Try again after midnight UTC.";

/** Backstop on tokens minted per UTC day (see countMintsToday). A connected call is only
 *  counted once the client reports it, so this is the only ceiling that holds against a
 *  client that never does. Set well above DAILY_CALL_LIMIT so honest retries — a dropped
 *  connect, a backed-out screen — never reach it. */
export const DAILY_MINT_LIMIT = 15;

// What counts as a VOICE call that actually happened, as a PostgREST `or` filter. A session row
// is opened at token mint, so without this a mint that never connected (screen backed out of, a
// dead network) would burn a call the trader never had. Deliberately the same predicate the
// list route filters by: the meter, the history and the cap must agree on which rows are calls.
//
// Both signals are voice-only. `message_count.gt.0` is deliberately NOT here: the turn-based
// text companion opens its rows through this same table and then sets message_count, so
// including it made five text conversations exhaust the five-a-day VOICE allowance — the
// trader was refused a call they had never made. Only a hang-up duration or an ElevenLabs
// conversation id can come from a voice call.
export const REAL_CALL_FILTER = "duration_secs.gt.0,elevenlabs_conversation_id.not.is.null";

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

/** Rows opened today, connected or not — one per issued conversation token.
 *
 *  Counted unfiltered on purpose, so it stays server truth (see below). The cost of that is
 *  that a turn-based text conversation opens a row here too and is indistinguishable from a
 *  mint at creation time, so it also spends this budget. That is tolerable where it is not for
 *  DAILY_CALL_LIMIT: this is a loose backstop against a client that reports nothing, not the
 *  allowance the trader is shown. Give the rows a `kind` if the text coach is ever used enough
 *  for 15 a day to be reachable.
 *
 *  The cap above can only count calls the CLIENT told us about: a session row is opened at
 *  mint with no duration, no messages and no conversation id, so it matches none of
 *  REAL_CALL_FILTER until a PATCH reports one. A client that simply never reports therefore
 *  keeps countCallsToday at zero and can mint tokens — and bill connected voice minutes —
 *  without limit. This is the same number measured where the client cannot reach it.
 *
 *  Deliberately a second, looser limit rather than a replacement: counting mints as calls
 *  would charge a trader whose connection dropped before the call ever started. */
export async function countMintsToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("psychology_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${getTodayUtcDateString()}T00:00:00.000Z`);
  if (error || count === null || count === undefined) {
    throw new Error(`psychology_sessions mint count failed: ${error?.message ?? "no count"}`);
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
  // The SQLSTATE rides along on the thrown error: the transcript importer has to tell an
  // expected unique violation (migration 31 — the other writer won the race) from a real
  // write failure, and matching on message text is not a contract.
  if (error) throw Object.assign(new Error(`psychology_session_messages insert failed: ${error.message}`), { code: error.code });
}

/** Postgres unique_violation — the transcript race's losing writer (migration 31). */
export const UNIQUE_VIOLATION = "23505";

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
