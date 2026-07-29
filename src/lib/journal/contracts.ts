import { z } from "zod";

const journalMoodSchema = z.enum(["good", "okay", "tough"]);

// Who wrote the day. Mirrors journal_entries.source (check constraint in
// supabase/migration_27_broker_sync.sql): 'manual' predates the mobile app, 'mobile' is the
// trader typing in the app, 'broker' is the MetaApi importer. The importer may overwrite only
// its own rows, and that test is a `source = 'broker'` predicate on its UPDATE rather than a
// TypeScript check — read-then-decide leaves a gap for a manual save to land in and be clobbered.
export type JournalSource = "manual" | "mobile" | "broker";

/**
 * A day the importer wrote rather than one the trader logged. Its mood is the importer's
 * NOT-NULL placeholder and it carries no note or lesson, so anything that reads a day as the
 * trader's own account of it — coach context, weekly insight, mood strip — must leave it out.
 * The money on it is real and still counts. One definition per repo; every reader asks this.
 */
export const isImportedRow = (row: { source: JournalSource }): boolean => row.source === "broker";

/**
 * The days that belong to the trader's CURRENT challenge — those logged on or after it
 * started. Anything traded before signing up for this evaluation is not progress toward its
 * target: counting it pre-filled the target bar and told the coach they were further along
 * than the app showed them. Three surfaces ask this (challenge cockpit, the coach's spoken
 * standing, the per-entry note), so one definition. Pass `challengeStartedAt(rules)`; a config
 * saved before start tracking existed has no start, and is grandfathered to all-time.
 *
 * ponytail: the start is compared as its UTC day against entry_date, which the client writes
 * as a LOCAL day key — so a challenge started within hours of midnight can differ from the
 * app by one day. Store the trader's timezone if that ever matters.
 */
export function scopeToChallengeStart<T extends { entry_date: string }>(
  rows: T[],
  startedAt: string | null,
): T[] {
  if (!startedAt) return rows;
  const startDay = startedAt.slice(0, 10);
  return rows.filter((row) => row.entry_date >= startDay);
}

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
  // Capped at a year of daily sessions. The client pages the calendar back month by month by
  // WIDENING this window (never by cursor), because it must always hold every row down to the
  // month being viewed — a day left unloaded reads as unlogged, and logging it again upserts
  // over the stored row. The per-request aggregates scan already reads far more rows than
  // this, so one wide page costs materially less than a run of cursor requests would.
  limit: z.coerce.number().int().min(1).max(366).optional().default(31),
});

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
  source: JournalSource;
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
  // Who wrote the day, so the client can tell an imported one from a logged one (isImportedRow).
  source: JournalSource;
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
  // Every date the trader has logged, across the WHOLE history — not just the page. Without
  // it a day outside the loaded window reads as unlogged, and opening it offers a blank "new
  // session" form whose save upserts over the stored row.
  loggedDates: string[];
};

/**
 * A money figure for a set of days, and the currency it is actually in. Anything that turns
 * days into a single amount goes through here — four figures are shown or spoken to the trader
 * (journal header, challenge standing, the coach's weekly P&L, the per-entry note).
 *
 * Days are never converted between currencies, so adding £ to $ yields a total in neither.
 * Every headline figure takes the currency most of the scored days settled in and sums only
 * those. Broker sync makes mixing ordinary rather than freak: a first import writes up to 90
 * days in the account's base currency, which can outnumber what the trader typed and flip
 * which currency the label claims.
 *
 * ponytail: the minority currency's days are left out rather than converted. Upgrade path
 * when it matters: convert at the day's rate on import and store a normalised figure too.
 */
export function currencyTotals(
  rows: Array<Pick<JournalEntryRow, "pnl_amount" | "pnl_currency">>,
): { dominantCurrency: string; totalPnl: number } {
  const counts = new Map<string, number>();
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (row.pnl_amount === null) continue;
    const code = (row.pnl_currency || "GBP").toUpperCase();
    counts.set(code, (counts.get(code) ?? 0) + 1);
    sums.set(code, (sums.get(code) ?? 0) + Number(row.pnl_amount));
  }
  let dominantCurrency = "GBP";
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      dominantCurrency = code;
      bestCount = count;
    }
  }
  return { dominantCurrency, totalPnl: sums.get(dominantCurrency) ?? 0 };
}

// Lifetime header metrics over the trader's ENTIRE history, not the page the client renders,
// so they stay correct past one page. Rows must arrive newest-first (entry_date desc) so the
// streak reads from the most recent session backwards.
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
  const { dominantCurrency, totalPnl } = currencyTotals(withPnl);
  return {
    totalPnl,
    // Sign-based, so currency-independent: a winning day is a winning day whatever it
    // settled in. These stay across the whole history.
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
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
