import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSessionUser } from "@/lib/auth/session";
import { hasProAccess } from "@/lib/billing/require-pro";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";
import {
  generatePsychologyReply,
  ruleToAmount,
  shouldRecommendBreak,
  type ChallengeContext,
  type RecentEntry,
} from "@/lib/psychology/companion";
import type { ChallengeRules } from "@/lib/journal/challenge";
import type { PsychologyAssessmentRow } from "@/lib/psychology/assessment";

const companionRequestSchema = z.object({
  assessmentId: z.uuid(),
  transcript: z.string().trim().min(1).max(2_000),
  sessionId: z.uuid().optional(),
});

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

type JournalRow = {
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
  note: string | null;
  lesson: string | null;
};

type ChallengeConfigRow = {
  firm_name: string;
  account_size: number | string;
  account_type: string;
  rules: ChallengeRules;
};

// The trader's standing in their challenge, computed the same way the app does: cumulative
// P&L and days across all logged sessions, measured against the firm's scraped rules.
function buildChallengeContext(config: ChallengeConfigRow | null, rows: JournalRow[]): ChallengeContext | null {
  if (!config) return null;
  const withPnl = rows.filter((row) => row.pnl_amount !== null);
  const cumulativePnl = withPnl.reduce((sum, row) => sum + Number(row.pnl_amount), 0);
  const daysTraded = withPnl.length;
  const accountSize = Number(config.account_size);
  const targetAmount = ruleToAmount(config.rules.profit_target, accountSize);
  const maxDays = config.rules.max_trading_days;
  return {
    firmName: config.firm_name,
    accountType: config.account_type,
    accountSize,
    rules: config.rules,
    cumulativePnl,
    daysTraded,
    targetAmount,
    progressPct: targetAmount && targetAmount > 0 ? cumulativePnl / targetAmount : null,
    amountToGo: targetAmount != null ? targetAmount - cumulativePnl : null,
    daysLeft: maxDays != null ? Math.max(0, maxDays - daysTraded) : null,
  };
}

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

// Transcript persistence is the feature on the session-aware paths, so unlike the legacy
// fire-and-forget session log these writes must succeed before we respond — a failure
// throws into the route's catch and surfaces as a 500 the client can retry.
async function insertSessionMessage(
  supabase: SupabaseClient,
  message: { session_id: string; user_id: string; role: "user" | "coach"; content: string },
) {
  const { error } = await supabase.from("psychology_session_messages").insert(message);
  if (error) {
    throw new Error(`psychology_session_messages insert failed: ${error.message}`);
  }
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

  const input = parsedBody.data;

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to use the psychology coach.");
    }
    // Pro-only: each turn is a billed model call, so entitlement is enforced server
    // side — hiding the button in the client is not a control.
    if (!(await hasProAccess(session))) {
      return jsonApiError(403, "psychology_pro_required", "Voice coaching is a Pro feature.");
    }

    // These reads are independent — the live voice-call path can't afford to wait
    // for them serially, so fan them out and await together. The call-session read
    // (only when the client passed sessionId) doubles as the ownership check.
    const [assessmentQuery, journalQuery, configQuery, callSessionQuery] = await Promise.all([
      session.supabase
        .from("psychology_assessments")
        // Only the fields the prompt actually reads (see generatePsychologyReply): the
        // scores/labels, the q1–q5 + q29 situation answers, and the flag_* signals.
        .select(
          "total_score, zone_label, focus_area, q29_focus, " +
            "q1_trading_situation, q2_stress_level, q3_financial_situation, q4_sleep_quality, q5_energy_level, " +
            "flag_chasing, flag_compulsive, flag_financial_pressure, flag_sleep_poor, flag_rebuilding",
        )
        .eq("user_id", session.user.id)
        .eq("id", input.assessmentId)
        .single(),
      session.supabase
        .from("journal_entries")
        .select("entry_date, mood, pnl_amount, note, lesson")
        .eq("user_id", session.user.id)
        .order("entry_date", { ascending: false })
        .limit(60),
      session.supabase
        .from("challenge_config")
        .select("firm_name, account_size, account_type, rules")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      input.sessionId
        ? session.supabase
            .from("psychology_sessions")
            .select("id, message_count")
            .eq("user_id", session.user.id)
            .eq("id", input.sessionId)
            .maybeSingle()
        : Promise.resolve(null),
    ]);

    if (assessmentQuery.error || !assessmentQuery.data) {
      return jsonApiError(404, "psychology_assessment_missing", "Complete the psychology assessment first.");
    }

    const rows = (journalQuery.data ?? []) as JournalRow[];

    const journal = journalContext(rows);
    const challenge = buildChallengeContext((configQuery.data as ChallengeConfigRow | null) ?? null, rows);
    const recentEntries: RecentEntry[] = rows.slice(0, 5).map((row) => ({
      date: row.entry_date,
      pnl: row.pnl_amount == null ? null : Number(row.pnl_amount),
      mood: row.mood,
      note: row.note,
      lesson: row.lesson,
    }));

    const coachContext = {
      name: session.user.user_metadata?.name ?? session.user.email ?? "there",
      assessment: assessmentQuery.data as unknown as PsychologyAssessmentRow & Record<string, unknown>,
      journal,
      challenge,
      recentEntries,
    };

    const transcript = input.transcript;

    // Resolve the call's session: reuse the one the client threaded (turns 2+), else
    // open a fresh row now (the first turn). Opening it here — rather than logging a
    // contentless row — means the very first exchange is stored and message_count always
    // equals the messages actually written (2 per turn), never drifting off by the
    // un-stored opener. The client reuses the returned sessionId for every later turn.
    let callSession: { id: string; message_count: number } | null = null;
    if (input.sessionId) {
      if (callSessionQuery?.error) {
        throw new Error(`psychology_sessions read failed: ${callSessionQuery.error.message}`);
      }
      const existing = (callSessionQuery?.data ?? null) as { id: string; message_count: number } | null;
      if (!existing) {
        return jsonApiError(404, "psychology_session_missing", "That coaching session was not found.");
      }
      callSession = existing;
    }

    // Generation doesn't need the session id, so it starts first and the first turn's
    // session insert (plus the user-message write, which does need the id) overlaps
    // the model call — keeping the voice call snappy without giving up durability.
    const replyPromise = generatePsychologyReply({ ...coachContext, transcript });
    if (!callSession) {
      const created = await session.supabase
        .from("psychology_sessions")
        .insert({
          user_id: session.user.id,
          assessment_id: input.assessmentId,
          message_count: 0,
          break_recommended: false,
        })
        .select("id, message_count")
        .single();
      if (created.error || !created.data) {
        throw new Error(`psychology_sessions insert failed: ${created.error?.message ?? "no row"}`);
      }
      callSession = created.data as { id: string; message_count: number };
    }
    const [reply] = await Promise.all([
      replyPromise,
      insertSessionMessage(session.supabase, {
        session_id: callSession.id,
        user_id: session.user.id,
        role: "user",
        content: transcript,
      }),
    ]);
    const breakRecommended = shouldRecommendBreak(journal);

    // Coach message + counters are independent writes; both must land before we respond.
    // Turns are sequential on a live call, so the read-then-write increment is race-free.
    const [, sessionUpdate] = await Promise.all([
      insertSessionMessage(session.supabase, {
        session_id: callSession.id,
        user_id: session.user.id,
        role: "coach",
        content: reply,
      }),
      session.supabase
        .from("psychology_sessions")
        .update({
          message_count: callSession.message_count + 2,
          break_recommended: breakRecommended,
        })
        .eq("id", callSession.id)
        .eq("user_id", session.user.id),
    ]);

    if (sessionUpdate.error) {
      throw new Error(`psychology_sessions update failed: ${sessionUpdate.error.message}`);
    }

    return NextResponse.json(
      { sessionId: callSession.id, reply, breakRecommended },
      { headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (error) {
    logger.error("Psychology companion request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "psychology_companion_failed", "The psychology coach is unavailable right now.");
  }
}
