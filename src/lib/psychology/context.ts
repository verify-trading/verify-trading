import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChallengeRules } from "@/lib/journal/challenge";
import type { PsychologyAssessmentRow } from "@/lib/psychology/assessment";
import {
  ruleToAmount,
  type ChallengeContext,
  type JournalContext,
  type PsychologyCoachContext,
  type RecentEntry,
} from "@/lib/psychology/companion";

// Persona-data assembly shared by the two coach brains: the turn-based companion route
// (user-scoped Supabase client) and the realtime custom-LLM endpoint (service-role client
// scoped by an explicit userId). The reads and derivations are identical so the coach's
// grounding is byte-for-byte the same on both paths — extracted verbatim from the companion
// route, not rewritten.

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

function journalContext(rows: JournalRow[]): JournalContext {
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

// Loads everything the coach persona needs for one user + assessment. Returns null when the
// assessment isn't found (missing or not the caller's). `journal` is handed back too because
// the caller still needs it for shouldRecommendBreak on the turn-based path.
export async function loadCoachContext(
  supabase: SupabaseClient,
  userId: string,
  assessmentId: string,
  name: string,
): Promise<{ coachContext: PsychologyCoachContext; journal: JournalContext } | null> {
  const [assessmentQuery, journalQuery, configQuery] = await Promise.all([
    supabase
      .from("psychology_assessments")
      // Only the fields the prompt actually reads (see buildPsychologyCoachInstructions): the
      // scores/labels, the q1–q5 + q29 situation answers, and the flag_* signals.
      .select(
        "total_score, zone_label, focus_area, q29_focus, " +
          "q1_trading_situation, q2_stress_level, q3_financial_situation, q4_sleep_quality, q5_energy_level, " +
          "flag_chasing, flag_compulsive, flag_financial_pressure, flag_sleep_poor, flag_rebuilding",
      )
      .eq("user_id", userId)
      .eq("id", assessmentId)
      .single(),
    supabase
      .from("journal_entries")
      .select("entry_date, mood, pnl_amount, note, lesson")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(60),
    supabase
      .from("challenge_config")
      .select("firm_name, account_size, account_type, rules")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (assessmentQuery.error || !assessmentQuery.data) return null;

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

  const coachContext: PsychologyCoachContext = {
    name,
    assessment: assessmentQuery.data as unknown as PsychologyAssessmentRow & Record<string, unknown>,
    journal,
    challenge,
    recentEntries,
  };

  return { coachContext, journal };
}
