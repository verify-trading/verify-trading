// Row shapes and API mappers for psychology voice-call sessions and their transcripts
// (tables: psychology_sessions + psychology_session_messages). The mobile client is
// built against the camelCase shapes below — keep them stable.

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
