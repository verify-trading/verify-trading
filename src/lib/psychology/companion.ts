import { generateText } from "ai";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import type { PsychologyAssessmentRow } from "@/lib/psychology/assessment";

type JournalContext = {
  sessionCount: number;
  weeklyPnl: number;
  wins: number;
  toughSessions: number;
  winningStreak: number;
  losingStreak: number;
};

const sectionLabels: Record<string, string> = {
  wrong: "Being Wrong",
  fear: "Fear",
  compulsion: "Chasing and Compulsion",
  awareness: "Self Awareness",
  discipline: "Discipline and Process",
};

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

export function shouldRecommendBreak(journal: JournalContext) {
  return journal.toughSessions >= 3 || journal.losingStreak >= 4;
}

export async function generatePsychologyReply(input: {
  name: string;
  transcript: string;
  assessment: PsychologyAssessmentRow & Record<string, unknown>;
  journal: JournalContext;
}) {
  const { assessment, journal } = input;
  const section = sectionLabels[String(assessment.focus_area)] ?? String(assessment.focus_area);
  const breakContext = shouldRecommendBreak(journal)
    ? "\nIMPORTANT: At a natural point, raise the idea of taking a break. Make it a mentor's honest observation, not a system alert."
    : "";

  const system = `You are the verify.trading Psychology AI - a personal coach and companion for ${input.name}, a retail forex trader.

You are not a trading signal service. Never give trade recommendations.
You are here purely for mental performance and psychological wellbeing.
You are warm but honest. Tell them what they need to hear.

Assessment score: ${assessment.total_score}/75 - ${assessment.zone_label}
Dominant pattern: ${section}
Focus area: ${assessment.q29_focus}
Trading situation: ${assessment.q1_trading_situation}
Current stress level: ${assessment.q2_stress_level}
Financial situation: ${assessment.q3_financial_situation}
Sleep quality: ${assessment.q4_sleep_quality}
Energy levels: ${assessment.q5_energy_level}

FLAGS:
${flagLines(assessment)}

JOURNAL DATA:
Current streak: ${journal.winningStreak || journal.losingStreak} (${journal.winningStreak > 0 ? "winning" : journal.losingStreak > 0 ? "losing" : "none"})
Last 7 days P&L: ${journal.weeklyPnl}
Sessions in last 7 days: ${journal.sessionCount}
Tough sessions in last 7 days: ${journal.toughSessions}

Use this data naturally. Do not announce that you are reading data.
Always end with one natural follow-up question.
Keep responses concise. Maximum 80 words.${breakContext}`;

  const result = await generateText({
    model: getAskSimpleModel(),
    maxOutputTokens: 220,
    system,
    prompt: input.transcript,
  });

  return result.text.trim();
}
