import { generateText } from "ai";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import { readUserDisplayName } from "@/lib/auth/read-user-display-name";
import { sectionLabels, type PsychologyAssessmentRow } from "@/lib/psychology/assessment";
import type { ChallengeRules } from "@/lib/journal/challenge";
import { ACCOUNT_TYPE_LABEL, money } from "@/lib/journal/format";

export type JournalContext = {
  sessionCount: number;
  weeklyPnl: number;
  wins: number;
  toughSessions: number;
  winningStreak: number;
  losingStreak: number;
};

// The trader's live prop-firm challenge — firm, rules, and where they stand against the
// target and the loss limits. This is what lets the coach give grounded, firm-specific
// guidance ("you're 12% to target with 22 days left, stay inside the 5% daily limit")
// instead of generic mindset talk.
export type ChallengeContext = {
  firmName: string;
  accountType: string;
  accountSize: number;
  rules: ChallengeRules;
  cumulativePnl: number;
  daysTraded: number;
  targetAmount: number | null;
  progressPct: number | null;
  amountToGo: number | null;
  daysLeft: number | null;
};

export type RecentEntry = {
  date: string;
  pnl: number | null;
  mood: string;
  note: string | null;
  lesson: string | null;
};

// Turn a scraped rule string ("10%", "$10,000", "$5k") into an amount for the account size.
export function ruleToAmount(rule: string | null | undefined, accountSize: number): number | null {
  if (!rule) return null;
  const pct = rule.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return (accountSize * Number(pct[1])) / 100;
  const num = rule.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (!num) return null;
  const multiplier = num[2]?.toLowerCase() === "m" ? 1_000_000 : num[2] ? 1_000 : 1;
  return Number(num[1]) * multiplier;
}

function flagLines(assessment: Record<string, unknown>) {
  const flags = [
    assessment.flag_chasing ? "Chasing behaviour is present." : null,
    assessment.flag_compulsive ? "Compulsion score is elevated." : null,
    assessment.flag_financial_pressure ? "Financial pressure is present; handle this carefully." : null,
    assessment.flag_sleep_poor ? "Sleep quality is poor." : null,
    assessment.flag_rebuilding ? "Trader is rebuilding after significant losses." : null,
  ].filter(Boolean);

  return flags.length > 0 ? flags.join("\n") : "No critical flags.";
}

function challengeBlock(challenge: ChallengeContext | null): string {
  if (!challenge) return "THE TRADER'S CHALLENGE:\nNo prop-firm challenge is configured yet — coach on general trading psychology.";
  const { rules } = challenge;
  const type = ACCOUNT_TYPE_LABEL[challenge.accountType] ?? challenge.accountType;
  const progress = challenge.progressPct != null ? `${Math.round(challenge.progressPct * 100)}% of target` : "no profit target detected";
  const target = challenge.targetAmount != null ? `${money(challenge.targetAmount)} (${rules.profit_target})` : rules.profit_target;
  const toGo = challenge.amountToGo != null ? `, ${money(Math.max(0, challenge.amountToGo))} to go` : "";
  const daysLeft = challenge.daysLeft != null ? `, ${challenge.daysLeft} days left` : "";
  return `THE TRADER'S CHALLENGE:
Firm: ${challenge.firmName} — ${type}, ${money(challenge.accountSize)} account.
Rules: profit target ${target}; daily loss limit ${rules.daily_loss_limit}; max drawdown ${rules.max_drawdown}; min trading days ${rules.min_trading_days ?? "n/a"}; weekend holding ${rules.weekend_holding ? "allowed" : "not allowed"}; news trading ${rules.news_trading_allowed ? "allowed" : "restricted"}.
Standing: cumulative P&L ${money(challenge.cumulativePnl)} (${progress})${toGo}; ${challenge.daysTraded} days traded${daysLeft}.
${rules.other_rules?.length ? `Notable: ${rules.other_rules.slice(0, 3).join("; ")}.` : ""}`;
}

function recentBlock(entries: RecentEntry[]): string {
  if (!entries.length) return "RECENT SESSIONS:\nNo journal entries yet.";
  const lines = entries.slice(0, 5).map((entry) => {
    const pnl = entry.pnl == null ? "no P&L" : `${entry.pnl >= 0 ? "+" : ""}${money(entry.pnl)}`;
    const note = entry.note ? ` — "${entry.note.slice(0, 90)}"` : "";
    const lesson = entry.lesson ? ` (lesson: ${entry.lesson.slice(0, 70)})` : "";
    return `- ${entry.date}: ${pnl}, ${entry.mood}${note}${lesson}`;
  });
  return `RECENT SESSIONS (most recent first):\n${lines.join("\n")}`;
}

// The trader's own name is the one piece of free text that reaches the coach's system prompt
// verbatim, and user_metadata is client-written JSON. readUserDisplayName already drops
// non-strings (a name of {} rendered as "[object Object]" in the coach's opening line) and
// trims; whitespace is flattened on top of it because a newline is what lets the value forge
// prompt structure below, and the length is capped because the prompt is re-sent every turn.
// One helper for both coach paths — realtime mint and turn-based companion — so neither can
// drift into passing the raw value.
export function coachDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const name = readUserDisplayName(user.user_metadata) ?? user.email ?? "there";
  return name.replace(/\s+/g, " ").slice(0, 80);
}

export function shouldRecommendBreak(journal: JournalContext) {
  return journal.toughSessions >= 3 || journal.losingStreak >= 4;
}

export function buildPsychologyCoachInstructions(input: {
  name: string;
  assessment: PsychologyAssessmentRow & Record<string, unknown>;
  journal: JournalContext;
  challenge?: ChallengeContext | null;
  recentEntries?: RecentEntry[];
  realtime?: boolean;
}) {
  const { assessment, journal } = input;
  const section = sectionLabels[assessment.focus_area] ?? String(assessment.focus_area);
  // ponytail: the realtime (ElevenLabs) path can't surface the UI break-nudge — that flag rode
  // the turn-based companion response, which the live call bypasses. Realtime v1 instead tells
  // the coach to voice the break aloud whenever it fits; the visual nudge card is dropped there.
  const breakContext = input.realtime
    ? "\nIf a break would genuinely help them, say so out loud — a mentor's honest observation, not a system alert."
    : shouldRecommendBreak(journal)
      ? "\nIMPORTANT: At a natural point, raise the idea of taking a break. Make it a mentor's honest observation, not a system alert."
      : "";

  return `You are ${input.name}'s coach at verify.trading — a personal coach and companion for a retail prop-firm trader, on a live voice call.

You are not a trading signal service. Never give trade recommendations or entries/exits.
You are here for mental performance, risk discipline, and psychological wellbeing.
You are warm but honest — tell them what they need to hear. Speak naturally, like a real call.

You know their full situation below. USE IT: reference their firm's actual rules, how close they are to the target, the daily-loss/drawdown limits they must respect, and their recent sessions — concretely and naturally, without announcing that you're reading data.

ASSESSMENT:
Score: ${assessment.total_score}/75 — ${assessment.zone_label}. Dominant pattern: ${section}. Focus: ${assessment.q29_focus}.
Situation: ${assessment.q1_trading_situation}. Stress: ${assessment.q2_stress_level}. Financial: ${assessment.q3_financial_situation}. Sleep: ${assessment.q4_sleep_quality}. Energy: ${assessment.q5_energy_level}.
FLAGS:
${flagLines(assessment)}

${challengeBlock(input.challenge ?? null)}

WEEK: ${journal.sessionCount} sessions, P&L ${money(journal.weeklyPnl)}, ${journal.toughSessions} tough. Current streak: ${journal.winningStreak || journal.losingStreak} (${journal.winningStreak > 0 ? "winning" : journal.losingStreak > 0 ? "losing" : "none"}).

${recentBlock(input.recentEntries ?? [])}

Keep it conversational and tight — 40 to 80 words, since it's spoken aloud. Plain text only — no markdown, no lists — your reply is read aloud. Always end with one natural follow-up question.${breakContext}`;
}

export type PsychologyCoachContext = {
  name: string;
  assessment: PsychologyAssessmentRow & Record<string, unknown>;
  journal: JournalContext;
  challenge?: ChallengeContext | null;
  recentEntries?: RecentEntry[];
};

export async function generatePsychologyReply(input: PsychologyCoachContext & { transcript: string }) {
  const result = await generateText({
    model: getAskSimpleModel(),
    maxOutputTokens: 240,
    system: buildPsychologyCoachInstructions(input),
    prompt: input.transcript,
  });

  return speakable(result.text).trim();
}

// Markdown glyphs are read aloud by TTS ("star star right star star"), so strip them from
// anything headed for a voice; newlines collapse to spaces to preserve sentence flow.
// Exported because the realtime path streams deltas and applies the same cleanup per chunk —
// which is why this must NOT trim. A model delta carries its own leading space (" the"), so
// trimming per chunk welded the words together and TTS spoke "withthe sleep you've been
// getting". Whole-text callers trim their own result instead.
export function speakable(text: string): string {
  return text.replace(/[*_`#>|~]/g, " ").replace(/\s+/g, " ");
}
