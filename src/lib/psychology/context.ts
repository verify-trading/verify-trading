import type { SupabaseClient } from "@supabase/supabase-js";

import { challengeStartedAt, type ChallengeRules } from "@/lib/journal/challenge";
import { currencyTotals, isImportedRow, scopeToChallengeStart, type JournalSource } from "@/lib/journal/contracts";
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
// scoped by an explicit userId). Reads and derivations must stay identical so the coach's
// grounding is byte-for-byte the same on both paths.

// The coach may reason about the money — that part is real — but must never read an
// imported day's mood as the trader's own, or count it as evidence they journaled. That
// test is `isImportedRow`, called directly so a grep for it finds every enforcement site.
type JournalRow = {
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
  pnl_currency: string;
  note: string | null;
  lesson: string | null;
  source: JournalSource;
};

type ChallengeConfigRow = {
  firm_name: string;
  account_size: number | string;
  account_type: string;
  rules: ChallengeRules;
};

// The trader's standing in their challenge, computed the same way the app's cockpit does:
// cumulative P&L and days over the sessions logged since the challenge STARTED, measured
// against the firm's scraped rules. Reading all-time history here is what had the coach say
// "you're 140% to target" out loud over a screen showing a fresh challenge at zero.
function buildChallengeContext(config: ChallengeConfigRow | null, allRows: JournalRow[]): ChallengeContext | null {
  if (!config) return null;
  const rows = scopeToChallengeStart(allRows, challengeStartedAt(config.rules));
  const withPnl = rows.filter((row) => row.pnl_amount !== null);
  // The coach says this number out loud against the firm's target, so it has to be an
  // amount in one currency rather than a blend of every account the trader has logged.
  const { totalPnl: cumulativePnl } = currencyTotals(withPnl);
  // Days traded counts sessions, not money, so it spans every currency.
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
  // Today and the six days before it — seven CALENDAR days, compared as day keys the way
  // entry_date is stored. Subtracting timestamps instead measured age from the row's UTC
  // midnight, so the seventh day fell out of "this week" at every hour except midnight.
  const weekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const weeklyRows = rows.filter((row) => row.entry_date >= weekStart);
  const streakRows = rows.filter((row) => row.pnl_amount !== null);
  const streakDirection = Number(streakRows[0]?.pnl_amount ?? 0) >= 0 ? "winning" : "losing";
  const streak = streakRows.findIndex((row) => {
    const pnl = Number(row.pnl_amount);
    return streakDirection === "winning" ? pnl <= 0 : pnl >= 0;
  });

  return {
    // Journaled sessions only. The P&L lines below stay over every row, imported included —
    // the trades happened either way, and the coach reasoning about the money is right.
    sessionCount: weeklyRows.filter((row) => !isImportedRow(row)).length,
    weeklyPnl: currencyTotals(weeklyRows).totalPnl,
    wins: weeklyRows.filter((row) => Number(row.pnl_amount ?? 0) > 0).length,
    toughSessions: weeklyRows.filter((row) => !isImportedRow(row) && row.mood === "tough").length,
    winningStreak: streakDirection === "winning" ? (streak === -1 ? streakRows.length : streak) : 0,
    losingStreak: streakDirection === "losing" ? (streak === -1 ? streakRows.length : streak) : 0,
  };
}

// Loads everything the coach persona needs for one user + assessment. Returns null when the
// assessment isn't found (missing or not the caller's). The turn-based path reads
// `.journal` off the result for shouldRecommendBreak.
export async function loadCoachContext(
  supabase: SupabaseClient,
  userId: string,
  assessmentId: string,
  name: string,
): Promise<PsychologyCoachContext | null> {
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
      .select("entry_date, mood, pnl_amount, pnl_currency, note, lesson, source")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(60),
    supabase
      .from("challenge_config")
      .select("firm_name, account_size, account_type, rules")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  // Every read must succeed. Treating a failed journal or challenge read as "no data" built a
  // coach that told a trader mid-challenge they had never logged a session — and on the
  // realtime path that wrong persona is then cached for the rest of the call.
  if (assessmentQuery.error || !assessmentQuery.data) return null;
  if (journalQuery.error || configQuery.error) return null;

  const rows = (journalQuery.data ?? []) as JournalRow[];
  const journal = journalContext(rows);
  const challenge = buildChallengeContext((configQuery.data as ChallengeConfigRow | null) ?? null, rows);
  // Imported days would arrive here as a date, a number, a placeholder mood and two nulls —
  // nothing for the coach to reflect back, and a feeling the trader never reported.
  const recentEntries: RecentEntry[] = rows.filter((row) => !isImportedRow(row)).slice(0, 5).map((row) => ({
    date: row.entry_date,
    pnl: row.pnl_amount == null ? null : Number(row.pnl_amount),
    mood: row.mood,
    note: row.note,
    lesson: row.lesson,
  }));

  return {
    name,
    assessment: assessmentQuery.data as unknown as PsychologyAssessmentRow & Record<string, unknown>,
    journal,
    challenge,
    recentEntries,
  };
}
