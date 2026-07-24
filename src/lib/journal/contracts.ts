import { z } from "zod";

const journalMoodSchema = z.enum(["good", "okay", "tough"]);

// Optional structured trade details, stored as a jsonb blob. Every field is optional:
// the trader can save a session outcome with none, some, or all of them filled in.
export const tradeDetailsSchema = z
  .object({
    asset: z.string().trim().max(40).optional(),
    direction: z.enum(["long", "short", "scalp"]).optional(),
    entryPrice: z.number().finite().nullable().optional(),
    stopLoss: z.number().finite().nullable().optional(),
    takeProfit: z.number().finite().nullable().optional(),
    positionSize: z.number().finite().nullable().optional(),
    entryAt: z.string().trim().max(40).nullable().optional(),
    timeframe: z.string().trim().max(20).optional(),
  })
  .nullable()
  .optional();

export type TradeDetails = NonNullable<z.infer<typeof tradeDetailsSchema>>;

// A session can't be logged before it happens. Aggregates read entry_date descending, so
// a future row lands at index 0 and is treated as the latest session: the header reports
// the wrong streak direction, and overheatTrigger's breakIndex of 0 means a real streak
// after it never fires the warning. One day of slack keeps traders in timezones ahead of
// UTC from being rejected while logging their own "today".
const notFutureDated = (value: string) => {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 1);
  return value <= limit.toISOString().slice(0, 10);
};

export const journalEntryCreateSchema = z.object({
  entryDate: z.iso.date().refine(notFutureDated, "Entry date cannot be in the future."),
  mood: journalMoodSchema,
  pnlAmount: z.number().finite().min(-9999999999.99).max(9999999999.99).nullable().optional(),
  pnlCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional().default("GBP"),
  note: z.string().trim().max(4_000).optional().default(""),
  lesson: z.string().trim().max(2_000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
  tradeDetails: tradeDetailsSchema,
});

export const overheatLogCreateSchema = z.object({
  triggerType: z.enum(["winning_streak", "losing_streak", "pnl_overheat"]),
  triggerValue: z.number().finite(),
  userResponse: z.enum(["break", "reduced_size"]),
});

export const journalEntryDeleteSchema = z.object({
  entryDate: z.iso.date(),
});

export const journalEntriesQuerySchema = z.object({
  // Capped at a year of daily sessions. Clients page the calendar back month by month
  // and must be able to pull a window that reaches the month being viewed — a day left
  // unloaded reads as unlogged, and logging it again upserts over the stored row. The
  // per-request aggregates scan already reads far more rows than this, so a larger page
  // costs materially less than the equivalent run of cursor requests.
  limit: z.coerce.number().int().min(1).max(366).optional().default(31),
  cursor: z.string().trim().min(1).optional(),
});

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;

export type JournalEntryRow = {
  id: string;
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | string | null;
  pnl_currency: string;
  note: string;
  lesson: string | null;
  challenge_status_note: string | null;
  tags: string[] | null;
  trade_details: TradeDetails | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  entryDate: string;
  mood: "good" | "okay" | "tough";
  pnlAmount: number | null;
  pnlCurrency: string;
  note: string;
  lesson: string | null;
  challengeStatusNote: string | null;
  tags: string[];
  tradeDetails: TradeDetails | null;
  createdAt: string;
  updatedAt: string;
};

export type JournalStreak = { count: number; type: "winning" | "losing" | "none" };

export type JournalAggregates = {
  totalPnl: number;
  wins: number;
  scored: number;
  lessonCount: number;
  winRate: number;
  streak: JournalStreak;
  // Most frequent non-null pnl currency across the scanned history, so the header total's
  // currency label reflects the full history rather than just the rendered page.
  dominantCurrency: string;
  // Every date the trader has logged, across the WHOLE history — not just the page.
  // The client pages entries (limit/cursor), so without this a day outside the loaded
  // window looks unlogged, and opening it would offer a blank "new session" form whose
  // save upserts over the existing row. Cheap to send: the rows are already scanned here.
  loggedDates: string[];
};

// Lifetime header metrics computed over the trader's ENTIRE history (not the paginated
// page the client renders), so P&L / positive-session count / streak are correct for
// traders with more sessions than one page holds. Rows must arrive newest-first
// (entry_date desc) so the streak reads from the most recent session backwards.
export function computeJournalAggregates(rows: JournalEntryRow[]): JournalAggregates {
  const withPnl = rows.filter((row) => row.pnl_amount !== null);
  const wins = withPnl.filter((row) => Number(row.pnl_amount) > 0).length;
  const scored = withPnl.length;
  const first = Number(withPnl[0]?.pnl_amount ?? 0);
  let streak: JournalStreak = { count: 0, type: "none" };
  if (first !== 0) {
    const winning = first > 0;
    const breakIndex = withPnl.findIndex((row) =>
      winning ? Number(row.pnl_amount) <= 0 : Number(row.pnl_amount) >= 0,
    );
    streak = { count: breakIndex === -1 ? withPnl.length : breakIndex, type: winning ? "winning" : "losing" };
  }
  // Dominant currency: the most common currency among scored sessions, so a blended header
  // total is at least labelled with the currency most of it is in (entries aren't converted).
  const currencyCounts = new Map<string, number>();
  for (const row of withPnl) {
    const code = (row.pnl_currency || "GBP").toUpperCase();
    currencyCounts.set(code, (currencyCounts.get(code) ?? 0) + 1);
  }
  let dominantCurrency = "GBP";
  let bestCount = 0;
  for (const [code, count] of currencyCounts) {
    if (count > bestCount) {
      dominantCurrency = code;
      bestCount = count;
    }
  }
  return {
    totalPnl: withPnl.reduce((sum, row) => sum + Number(row.pnl_amount), 0),
    wins,
    scored,
    lessonCount: rows.filter((row) => Boolean(row.lesson)).length,
    winRate: scored ? Math.round((wins / scored) * 100) : 0,
    streak,
    dominantCurrency,
    loggedDates: rows.map((row) => row.entry_date),
  };
}

export function toJournalEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    mood: row.mood,
    pnlAmount: row.pnl_amount === null ? null : Number(row.pnl_amount),
    pnlCurrency: row.pnl_currency,
    note: row.note,
    lesson: row.lesson,
    challengeStatusNote: row.challenge_status_note,
    tags: row.tags ?? [],
    tradeDetails: row.trade_details ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
