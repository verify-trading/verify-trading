import type { SupabaseClient } from "@supabase/supabase-js";

import { challengeStartedAt, type ChallengeRules } from "@/lib/journal/challenge";
import { currencyTotals, isImportedRow, scopeToChallengeStart, type JournalSource } from "@/lib/journal/contracts";
import type { PsychologyAssessmentRow } from "@/lib/psychology/assessment";
import {
  ruleToAmount,
  type ChallengeContext,
  type JournalContext,
  type LastCall,
  type PsychologyCoachContext,
  type RecentEntry,
} from "@/lib/psychology/companion";

// Shared by both coach brains: the companion route (user-scoped client) and the realtime
// custom-LLM endpoint (service-role client scoped by an explicit userId).

// The coach may reason about imported money, but never about an imported day's mood, and
// never counts one as evidence they journaled. That test is `isImportedRow`.
type JournalRow = {
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
  pnl_currency: string;
  note: string | null;
  lesson: string | null;
  source: JournalSource;
  // Read only by isImportedRow, for CSV days predating the source:'csv' stamp.
  // Droppable once migration 32 has backfilled those rows.
  tags: string[] | null;
};

type ChallengeConfigRow = {
  firm_name: string;
  account_size: number | string;
  account_type: string;
  rules: ChallengeRules;
};

// Scoped to sessions logged since the challenge STARTED. Reading all-time history here had
// the coach say "you're 140% to target" over a screen showing a fresh challenge at zero.
function buildChallengeContext(config: ChallengeConfigRow | null, allRows: JournalRow[]): ChallengeContext | null {
  if (!config) return null;
  const rows = scopeToChallengeStart(allRows, challengeStartedAt(config.rules));
  const withPnl = rows.filter((row) => row.pnl_amount !== null);
  // One currency: this is spoken aloud against the firm's target, not a blend of accounts.
  const { totalPnl: cumulativePnl } = currencyTotals(withPnl);
  // Sessions, not money, so it spans every currency.
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
  // Seven CALENDAR days, compared as day keys. Subtracting timestamps instead dropped the
  // seventh day out of "this week" at every hour except midnight.
  const weekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const weeklyRows = rows.filter((row) => row.entry_date >= weekStart);
  const streakRows = rows.filter((row) => row.pnl_amount !== null);
  const streakDirection = Number(streakRows[0]?.pnl_amount ?? 0) >= 0 ? "winning" : "losing";
  const streak = streakRows.findIndex((row) => {
    const pnl = Number(row.pnl_amount);
    return streakDirection === "winning" ? pnl <= 0 : pnl >= 0;
  });

  return {
    // Journaled sessions only; the P&L lines below stay over every row, imported included.
    sessionCount: weeklyRows.filter((row) => !isImportedRow(row)).length,
    weeklyPnl: currencyTotals(weeklyRows).totalPnl,
    wins: weeklyRows.filter((row) => Number(row.pnl_amount ?? 0) > 0).length,
    toughSessions: weeklyRows.filter((row) => !isImportedRow(row) && row.mood === "tough").length,
    winningStreak: streakDirection === "winning" ? (streak === -1 ? streakRows.length : streak) : 0,
    losingStreak: streakDirection === "losing" ? (streak === -1 ? streakRows.length : streak) : 0,
  };
}

const TAIL_CHARS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A coach that knows nothing about earlier calls INVENTS them, so hand it the real tail of the
// last one. "error" is distinct from null: "no prior call" is a fact the prompt states, a failed
// read is not, and it fails the whole context.
//
// currentSessionId is excluded BY ID, not by message_count: the turn-based companion rebuilds
// this context on every turn and raises message_count as it goes, so from turn 2 on the live
// conversation was being handed back as its own "LAST CALL" — the coach recalling as history
// something said a turn ago, which is the misattribution this whole block exists to prevent.
async function loadLastCall(
  supabase: SupabaseClient,
  userId: string,
  currentSessionId?: string | null,
): Promise<LastCall | null | "error"> {
  let query = supabase
    .from("psychology_sessions")
    .select("id, created_at", { count: "exact" })
    .eq("user_id", userId)
    .gt("message_count", 0);
  // Only a well-formed id is worth excluding: `id` is a uuid column, so comparing it against
  // anything else is a Postgres type error, which fails this read, nulls the whole context and
  // ends the call as "assessment not found". A malformed id matches no row anyway.
  if (currentSessionId && UUID.test(currentSessionId)) query = query.neq("id", currentSessionId);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data) return "error";
  const session = (data as unknown as Array<{ id: string; created_at: string }>)[0];
  if (!session) return null;

  // Newest-first so the cap keeps the END of the call, then flipped back into spoken order.
  const messages = await supabase
    .from("psychology_session_messages")
    .select("role, content")
    .eq("user_id", userId)
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(12);
  if (messages.error || !messages.data) return "error";

  const spoken = (messages.data as unknown as Array<{ role: string; content: string }>)
    // Whitespace flattened: trader-written text lands in a structured system prompt, and a
    // newline is what would let one forge a block header.
    .map((row) => `${row.role === "coach" ? "You" : "Them"}: ${row.content.replace(/\s+/g, " ").trim()}`)
    .reverse()
    .join("\n");
  const transcript = spoken.length > TAIL_CHARS ? `…${spoken.slice(-TAIL_CHARS)}` : spoken;

  return { createdAt: session.created_at, transcript, priorCalls: count ?? 1 };
}

// Returns null when the assessment isn't found (missing, or not the caller's).
export async function loadCoachContext(
  supabase: SupabaseClient,
  userId: string,
  assessmentId: string,
  name: string,
  // The call this context is being built FOR, so it can't become its own memory. See loadLastCall.
  currentSessionId?: string | null,
): Promise<PsychologyCoachContext | null> {
  const [assessmentQuery, journalQuery, configQuery, lastCall] = await Promise.all([
    supabase
      .from("psychology_assessments")
      // Only the fields the prompt reads. created_at rides along because the prompt dates the
      // check-in: undated, the coach spoke a days-old sleep answer as the trader's state today.
      .select(
        "created_at, total_score, zone_label, focus_area, q29_focus, " +
          "q1_trading_situation, q2_stress_level, q3_financial_situation, q4_sleep_quality, q5_energy_level, " +
          "flag_chasing, flag_compulsive, flag_financial_pressure, flag_sleep_poor, flag_rebuilding",
      )
      .eq("user_id", userId)
      .eq("id", assessmentId)
      .single(),
    supabase
      .from("journal_entries")
      .select("entry_date, mood, pnl_amount, pnl_currency, note, lesson, source, tags")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(60),
    supabase
      .from("challenge_config")
      .select("firm_name, account_size, account_type, rules")
      .eq("user_id", userId)
      .maybeSingle(),
    loadLastCall(supabase, userId, currentSessionId),
  ]);

  // Every read must succeed or the whole context is null. Treating a failed journal read as
  // "no data" built a coach that told a mid-challenge trader they had never logged a session,
  // and the realtime path then caches that wrong persona for the rest of the call.
  if (assessmentQuery.error || !assessmentQuery.data) return null;
  if (journalQuery.error || configQuery.error || lastCall === "error") return null;

  const rows = (journalQuery.data ?? []) as JournalRow[];
  const journal = journalContext(rows);
  const challenge = buildChallengeContext((configQuery.data as ChallengeConfigRow | null) ?? null, rows);
  // Imported days carry a placeholder mood the trader never reported, so they are dropped.
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
    lastCall,
  };
}
