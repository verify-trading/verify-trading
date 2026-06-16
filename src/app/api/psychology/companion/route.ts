import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import { generatePsychologyReply, shouldRecommendBreak } from "@/lib/psychology/companion";
import type { PsychologyAssessmentRow } from "@/lib/psychology/assessment";

const companionRequestSchema = z.object({
  assessmentId: z.uuid(),
  transcript: z.string().trim().min(1).max(2_000),
});

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

type JournalRow = {
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
};

function journalContext(rows: JournalRow[]) {
  const weeklyRows = rows.filter((row) => {
    const age = Date.now() - new Date(row.entry_date).getTime();
    return age <= 7 * 24 * 60 * 60 * 1000;
  });
  const streakRows = rows.filter((row) => row.pnl_amount !== null);
  const streakDirection = Number(streakRows[0]?.pnl_amount ?? 0) >= 0 ? "winning" : "losing";
  const streak = streakRows.findIndex((row) => {
    const pnl = Number(row.pnl_amount);
    return streakDirection === "winning" ? pnl <= 0 : pnl >= 0;
  });

  return {
    sessionCount: weeklyRows.length,
    weeklyPnl: weeklyRows.reduce((sum, row) => sum + Number(row.pnl_amount ?? 0), 0),
    wins: weeklyRows.filter((row) => Number(row.pnl_amount ?? 0) > 0).length,
    toughSessions: weeklyRows.filter((row) => row.mood === "tough").length,
    winningStreak: streakDirection === "winning" ? (streak === -1 ? streakRows.length : streak) : 0,
    losingStreak: streakDirection === "losing" ? (streak === -1 ? streakRows.length : streak) : 0,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonApiError(400, "psychology_companion_invalid", "The psychology companion request body is invalid.");
  }

  const parsedBody = companionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonApiError(400, "psychology_companion_invalid", "The psychology companion request body is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to use the psychology coach.");
    }

    const assessmentQuery = await session.supabase
      .from("psychology_assessments")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("id", parsedBody.data.assessmentId)
      .single();

    if (assessmentQuery.error || !assessmentQuery.data) {
      return jsonApiError(404, "psychology_assessment_missing", "Complete the psychology assessment first.");
    }

    const journalQuery = await session.supabase
      .from("journal_entries")
      .select("entry_date, mood, pnl_amount")
      .eq("user_id", session.user.id)
      .order("entry_date", { ascending: false })
      .limit(10);

    const journal = journalContext((journalQuery.data ?? []) as JournalRow[]);
    const reply = await generatePsychologyReply({
      name: session.user.user_metadata?.name ?? session.user.email ?? "there",
      transcript: parsedBody.data.transcript,
      assessment: assessmentQuery.data as PsychologyAssessmentRow & Record<string, unknown>,
      journal,
    });
    const breakRecommended = shouldRecommendBreak(journal);

    await session.supabase.from("psychology_sessions").insert({
      user_id: session.user.id,
      assessment_id: parsedBody.data.assessmentId,
      message_count: 1,
      break_recommended: breakRecommended,
    });

    return NextResponse.json({ reply, breakRecommended }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Psychology companion request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_companion_failed", "The psychology coach is unavailable right now.");
  }
}
