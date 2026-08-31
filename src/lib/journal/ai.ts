import { generateText } from "ai";

import { getAskSimpleModel } from "@/lib/ask/service/provider";
import type { ChallengeConfigRow } from "@/lib/journal/challenge";
import type { JournalEntryRow } from "@/lib/journal/contracts";
import { ACCOUNT_TYPE_LABEL, money } from "@/lib/journal/format";

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
    maxOutputTokens: 60,
    system:
      "You are the trader's coach at verify.trading. Reply with ONE short, specific sentence (max 20 words) " +
      "of honest, encouraging guidance for the trader's next session. " +
      "You are not a trading signal service — never give trade recommendations or entries/exits. " +
      "The app shows the exact numbers separately, so do NOT restate stats. " +
      "Plain text only — no markdown, no tables, no lists, no line breaks.",
    prompt: `Prop firm: ${input.config.firm_name}
Account type: ${ACCOUNT_TYPE_LABEL[input.config.account_type] ?? input.config.account_type}
Rules: ${JSON.stringify(input.config.rules)}
Today's P&L: ${money(Number(input.entry.pnl_amount ?? 0))}
Cumulative P&L this period: ${money(input.cumulativePnl)}
Days traded this evaluation: ${input.daysTraded}
Write one coaching sentence for their next session.`,
  });
  return oneLine(result.text);
}

// The app renders this as a single coaching line beside its own computed stats, so
// collapse any stray markdown, table pipes, or line breaks the model emits into one
// clean sentence.
function oneLine(text: string): string {
  return text.replace(/[*_`#>|]/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateWeeklyInsight(entries: JournalEntryRow[]) {
  // Only fields used to write the insight leave our server. Database ids, account email,
  // source markers and storage timestamps are unnecessary and deliberately excluded.
  const sessions = entries.map((entry) => ({
    date: entry.entry_date,
    mood: entry.mood,
    pnl: entry.pnl_amount,
    currency: entry.pnl_currency,
    note: entry.note,
    lesson: entry.lesson,
    tags: entry.tags,
  }));
  const result = await generateText({
    model: getAskSimpleModel(),
    maxOutputTokens: 140,
    system:
      "You are the trader's coach at verify.trading. Identify one meaningful trading pattern in under 60 words. " +
      "Be calm, direct, and honest — tell them what they need to hear, not what flatters them. " +
      "Plain text only — no markdown.",
    prompt: `Sessions (last 30 days): ${JSON.stringify(sessions)}
Identify the single most useful pattern in this data.`,
  });
  return oneLine(result.text);
}
