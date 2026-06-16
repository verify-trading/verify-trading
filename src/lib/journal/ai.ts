import { generateText } from "ai";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import type { ChallengeConfigRow } from "@/lib/journal/challenge";
import type { JournalEntryRow } from "@/lib/journal/contracts";

export function overheatTrigger(entries: JournalEntryRow[]) {
  const pnlEntries = entries.filter((entry) => entry.pnl_amount !== null);
  const first = Number(pnlEntries[0]?.pnl_amount ?? 0);
  if (first === 0) return null;
  const winning = first > 0;
  const breakIndex = pnlEntries.findIndex((entry) => winning ? Number(entry.pnl_amount) <= 0 : Number(entry.pnl_amount) >= 0);
  const count = breakIndex === -1 ? pnlEntries.length : breakIndex;

  if (winning && count >= 7) return { triggerType: "winning_streak" as const, triggerValue: count };
  if (!winning && count >= 5) return { triggerType: "losing_streak" as const, triggerValue: count };
  return null;
}

export async function generateChallengeStatus(input: {
  config: ChallengeConfigRow;
  entry: JournalEntryRow;
  cumulativePnl: number;
  daysTraded: number;
}) {
  const result = await generateText({
    model: getAskSimpleModel(),
    maxOutputTokens: 140,
    system: "You are a prop firm challenge assistant. Under 60 words. Be specific with numbers and percentages.",
    prompt: `Prop firm: ${input.config.firm_name}
Account size: ${input.config.account_size}
Account type: ${input.config.account_type}
Rules: ${JSON.stringify(input.config.rules)}
Today's P&L: ${input.entry.pnl_amount}
Cumulative P&L this period: ${input.cumulativePnl}
Days traded this evaluation: ${input.daysTraded}
Generate the challenge status note.`,
  });
  return result.text.trim();
}

export async function generateWeeklyInsight(entries: JournalEntryRow[], name: string) {
  const result = await generateText({
    model: getAskSimpleModel(),
    maxOutputTokens: 140,
    system: "You are the verify.trading Journal AI. Identify one meaningful trading pattern. Under 60 words.",
    prompt: `Trader: ${name}
Sessions (last 30 days): ${JSON.stringify(entries)}
Identify the single most useful pattern in this data.`,
  });
  return result.text.trim();
}
