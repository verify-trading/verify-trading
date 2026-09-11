import { z } from "zod";

const journalMoodSchema = z.enum(["good", "okay", "tough"]);

// Who wrote the day. Mirrors journal_entries.source (check constraint in
// supabase/migration_27_broker_sync.sql, widened for 'csv' by migration 32).
// The importer may overwrite only its own rows, and that test is a `source = 'broker'` predicate
// on its UPDATE, never a TypeScript check: read-then-decide can clobber a manual save.
export type JournalSource = "manual" | "mobile" | "broker" | "csv";

/**
 * A day the importer wrote rather than one the trader logged. Its mood is a NOT-NULL placeholder
 * and it carries no note or lesson, so anything reading a day as the trader's own account of it
 * (coach context, weekly insight, mood strip) must leave it out. The money on it still counts.
 *
 * Two importers: MetaApi sync writes `source = 'broker'`, and a CSV import posts through the
 * normal entries route, which stamps `source = 'csv'`. The mobile predicate is the same set and
 * strips the bare 'csv' tag when the trader edits the day, which is what makes the day theirs.
 *
 * ponytail: the tags fallback is only for CSV rows written before the route stamped them, back
 * when the server said 'mobile' and the tag was the only mark left. Drop it once migration 32
 * is applied (its backfill rewrites those rows to 'csv'), at which point this stops needing
 * `tags` at all — until then any row reaching this must carry them, since a query that skips
 * the column reads every old CSV day as journaled.
 */
export const isImportedRow = (row: { source: JournalSource; tags: string[] | null }): boolean =>
  row.source === "broker" || row.source === "csv" || (row.tags?.includes("csv") ?? false);

/**
 * The days that belong to the trader's CURRENT challenge — those logged on or after it started.
 * Anything traded before signing up is not progress toward its target. Pass
 * `challengeStartedAt(rules)`; a config with no start is grandfathered to all-time.
 *
 * ponytail: the start is compared as its UTC day against entry_date, which the client writes
 * as a LOCAL day key — so a challenge started within hours of midnight can differ from the
 * app by one day. Store the trader's timezone if that ever matters.
 */
/**
 * Date boundary only. Prefer `scopeToChallenge` below for anything a trader sees: calling this
 * directly skips the ACCOUNT filter, which is how challenge figures came to count every entry
 * regardless of which account traded them.
 */
export function scopeToChallengeStart<T extends { entry_date: string }>(
  rows: T[],
  startedAt: string | null,
): T[] {
  if (!startedAt) return rows;
  const startDay = startedAt.slice(0, 10);
  return rows.filter((row) => row.entry_date >= startDay);
}

/**
 * The rows a challenge's figures may count: its account, then its start date.
 *
 * `tradingAccountId` null is LEGACY — a challenge configured before accounts existed — and means
 * every entry, which is what those challenges have always counted. It is deliberately NOT the
 * same as "a manual account", which has a real id: reading null as "unassigned entries only"
 * would silently empty a working challenge the day this shipped.
 */
export function scopeToChallenge<T extends { entry_date: string; trading_account_id?: string | null }>(
  rows: T[],
  challenge: { startedAt: string | null; tradingAccountId: string | null },
): T[] {
  const owned = challenge.tradingAccountId
    ? rows.filter((row) => row.trading_account_id === challenge.tradingAccountId)
    : rows;
  return scopeToChallengeStart(owned, challenge.startedAt);
}

// Stored as a jsonb blob. Every field is optional — a session can be saved with none of them.
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

// Aggregates read entry_date descending, so a future row lands at index 0 and is read as the
// latest session, breaking the streak direction and overheatTrigger's breakIndex. One day of
// slack keeps traders in timezones ahead of UTC from being rejected on their own "today".
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
  // Optional: builds that predate multi-account posting send nothing, and the route resolves an
  // account for them. Required-by-omission would break every app version already installed.
  tradingAccountId: z.uuid().nullable().optional(),
});

export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;

export const overheatLogCreateSchema = z.object({
  triggerType: z.enum(["winning_streak", "losing_streak", "pnl_overheat"]),
  triggerValue: z.number().finite(),
  userResponse: z.enum(["break", "reduced_size"]),
});

export const journalEntryDeleteSchema = z.object({
  entryDate: z.iso.date(),
  // Preferred addressing. A date stopped identifying one record once entries belong to accounts,
  // so a date-only delete would take a personal day and a challenge day together. Optional
  // because older builds send only the date, and pre-cutover a date still maps to one row.
  entryId: z.uuid().nullable().optional(),
});

export const journalEntriesQuerySchema = z.object({
  // Capped at a year of daily sessions. The client pages the calendar by WIDENING this window,
  // never by cursor: a day left unloaded reads as unlogged, and logging it again upserts over
  // the stored row.
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
  /** Null on rows that predate accounts; every new entry carries one. */
  trading_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  entryDate: string;
  tradingAccountId: string | null;
  mood: "good" | "okay" | "tough";
  pnlAmount: number | null;
  pnlCurrency: string;
  note: string;
  lesson: string | null;
  challengeStatusNote: string | null;
  tags: string[];
  tradeDetails: TradeDetails | null;
  // Lets the client tell an imported day from a logged one (isImportedRow).
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
  // Most frequent non-null pnl currency across the scanned history, not just the rendered page.
  dominantCurrency: string;
  // Every logged date across the WHOLE history: a day outside the loaded window would otherwise
  // read as unlogged and offer a blank form whose save upserts over the stored row.
  loggedDates: string[];
  /** `"<accountId>|<date>"`, empty prefix for an unassigned legacy row. See computeJournalAggregates. */
  loggedAccountDates: string[];
};

/**
 * A money figure for a set of days, and the currency it is actually in. Anything that turns days
 * into a single amount goes through here.
 *
 * Days are never converted, so adding £ to $ yields a total in neither. Every headline figure
 * takes the currency most of the scored days settled in and sums only those. Broker sync makes
 * mixing ordinary: a first import writes days in the account's base currency.
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

// Lifetime metrics over the ENTIRE history, not the rendered page. Rows must arrive newest-first
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
  const { dominantCurrency, totalPnl } = currencyTotals(withPnl);
  return {
    totalPnl,
    // Sign-based, so currency-independent, and counted across the whole history.
    wins,
    scored,
    lessonCount: rows.filter((row) => Boolean(row.lesson)).length,
    winRate: scored ? Math.round((wins / scored) * 100) : 0,
    streak,
    dominantCurrency,
    loggedDates: rows.map((row) => row.entry_date),
    // The same days, but each tagged with the account that owns it. `loggedDates` alone answers
    // "has ANY account logged this day?", which stopped being the useful question once a personal
    // day and a challenge day could share a date — it made the CSV importer skip days the
    // destination account had never seen. Empty prefix means an unassigned legacy row.
    loggedAccountDates: rows.map((row) => `${row.trading_account_id ?? ""}|${row.entry_date}`),
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
    tradingAccountId: row.trading_account_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
