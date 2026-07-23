// Row shapes and API mappers for psychology voice-call sessions and their transcripts
// (tables: psychology_sessions + psychology_session_messages). The mobile client is
// built against the camelCase shapes below — keep them stable.

import type { SupabaseClient } from "@supabase/supabase-js";

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
  rows: Array<{ session_id: string; user_id: string; role: "user" | "coach"; content: string }>,
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
