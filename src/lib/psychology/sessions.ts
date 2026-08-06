import type { SupabaseClient } from "@supabase/supabase-js";

import { getTodayUtcDateString } from "@/lib/rate-limit/usage";

// Calls per UTC day, enforced at token mint. The client reads this back from
// /api/psychology/usage rather than counting its own list, so both agree.
export const DAILY_CALL_LIMIT = 5;

export const DAILY_LIMIT_MESSAGE = `You've used today's ${DAILY_CALL_LIMIT} coaching calls. They reset at midnight UTC.`;

// Refusal from the mint backstop, not the allowance. Must not claim the five calls were used:
// whoever trips it is someone whose calls were never reported, so their meter reads under.
export const MINT_LIMIT_MESSAGE = "Too many calls started today. Try again after midnight UTC.";

// Backstop on tokens minted per UTC day. Set well above DAILY_CALL_LIMIT so honest retries
// (dropped connect, backed-out screen) never reach it.
export const DAILY_MINT_LIMIT = 15;

// What counts as a voice call that happened, as a PostgREST `or` filter. Shared with the list
// route so the meter, the history and the cap agree on which rows are calls.
// `message_count.gt.0` is deliberately NOT here: the turn-based text companion writes it too,
// so including it let five text conversations exhaust the five-a-day voice allowance.
export const REAL_CALL_FILTER = "duration_secs.gt.0,elevenlabs_conversation_id.not.is.null";

// Today's real calls, on the UTC day the limit resets on. Throws rather than guessing: a spend
// limit that fails open is not a limit.
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

// Rows opened today, connected or not — one per issued conversation token. Unfiltered on
// purpose: countCallsToday only sees calls the CLIENT reported, so a client that never reports
// holds it at zero and mints without limit. This is the same spend measured server-side.
// A text-companion conversation also spends this budget; tolerable for a loose backstop.
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

// Lifetime minutes + calls for the Mind header. Display-only; nothing is enforced on these.
export async function loadCallTotals(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ callsTotal: number; minutesTotal: number }> {
  const { data, error } = await supabase
    .from("psychology_sessions")
    .select("duration_secs")
    .eq("user_id", userId)
    .or(REAL_CALL_FILTER)
    // Explicit cap; PostgREST would silently apply ~1000 anyway.
    .limit(5000);
  if (error || !data) throw new Error(`psychology_sessions totals failed: ${error?.message ?? "no rows"}`);

  const rows = data as unknown as Array<{ duration_secs: number | null }>;
  const secs = rows.reduce((total, row) => total + Math.max(0, row.duration_secs ?? 0), 0);
  return { callsTotal: rows.length, minutesTotal: Math.floor(secs / 60) };
}

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

// Throws on failure: these writes must land before the route responds. Callers own their own
// message_count bookkeeping.
export async function insertSessionMessages(
  supabase: SupabaseClient,
  // created_at optional: the transcript importer stamps it per row to keep the spoken order.
  rows: Array<{ session_id: string; user_id: string; role: "user" | "coach"; content: string; created_at?: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("psychology_session_messages").insert(rows);
  // SQLSTATE rides along so the transcript importer can tell an expected unique violation
  // (migration 31, lost race) from a real write failure.
  if (error) throw Object.assign(new Error(`psychology_session_messages insert failed: ${error.message}`), { code: error.code });
}

// Postgres unique_violation — the transcript race's losing writer (migration 31).
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
