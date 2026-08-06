import { describe, expect, it, vi } from "vitest";

import { loadCoachContext } from "@/lib/psychology/context";

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, and awaiting it (or .single()/.maybeSingle()) resolves the provided result.
// If src ever adds a filter method (.not(), .gte(), ...) it must be added here too —
// otherwise the chain returns undefined and the failure surfaces as a bare null context.
function createQueryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "is", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

// entry_date keys the coach's 7-day window, so build them relative to now rather than
// hard-coding dates that would drift out of the window and pass for the wrong reason.
const dayKey = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

type Row = {
  entry_date: string;
  mood: "good" | "okay" | "tough";
  pnl_amount: number | null;
  pnl_currency?: string;
  note?: string | null;
  lesson?: string | null;
  source?: "manual" | "mobile" | "broker";
  tags?: string[] | null;
};

const journalRow = (row: Row) => ({
  pnl_currency: "GBP",
  note: null,
  lesson: null,
  source: "mobile" as const,
  tags: null,
  ...row,
});

const assessmentRow = { total_score: 40, zone_label: "Reactive Trader", focus_area: "compulsion", q29_focus: "stop revenge trading" };

function load(rows: Row[], config: unknown = null) {
  const journal = createQueryBuilder({ data: rows.map(journalRow), error: null });
  const from = vi.fn((table: string) => {
    if (table === "psychology_assessments") return createQueryBuilder({ data: assessmentRow, error: null });
    if (table === "journal_entries") return journal;
    return createQueryBuilder({ data: config, error: null });
  });
  return { journal, from, context: loadCoachContext({ from } as never, "user-1", "assessment-1", "Alex") };
}

describe("loadCoachContext", () => {
  it("hides an imported day from what the trader journaled, but keeps its money", async () => {
    const { context } = load([
      { entry_date: dayKey(0), mood: "okay", pnl_amount: 400, source: "broker", note: null },
      { entry_date: dayKey(1), mood: "okay", pnl_amount: -50, source: "broker" },
      { entry_date: dayKey(2), mood: "tough", pnl_amount: -100, note: "Chased the open." },
      { entry_date: dayKey(3), mood: "good", pnl_amount: 200, note: "Waited." },
    ]);
    const result = await context;

    // Two of the four days are the importer's, so only two are sessions the trader logged —
    // and only the one tough day they actually reported feeling.
    expect(result?.journal.sessionCount).toBe(2);
    expect(result?.journal.toughSessions).toBe(1);
    // The trades happened either way: every P&L on the week counts.
    expect(result?.journal.weeklyPnl).toBe(450);
    expect(result?.journal.wins).toBe(2);
    // An imported day is a date, a number and a placeholder mood — nothing to reflect back.
    expect(result?.recentEntries?.map((entry) => entry.date)).toEqual([dayKey(2), dayKey(3)]);
  });

  it("hides a CSV-imported day too, which arrives stamped 'mobile' and tagged", async () => {
    const { context } = load([
      { entry_date: dayKey(0), mood: "okay", pnl_amount: 300, tags: ["csv", "csv:1754"] },
      { entry_date: dayKey(1), mood: "tough", pnl_amount: -40, tags: ["csv", "csv:1754"] },
      // Edited by the trader, so the mobile stripped the bare 'csv' tag: this day is theirs.
      { entry_date: dayKey(2), mood: "tough", pnl_amount: -100, note: "Chased.", tags: ["csv:1754"] },
    ]);
    const result = await context;

    // The fabricated 'okay'/'tough' placeholders are not sessions the trader journaled, and
    // the imported tough day is not a feeling they reported.
    expect(result?.journal.sessionCount).toBe(1);
    expect(result?.journal.toughSessions).toBe(1);
    expect(result?.recentEntries?.map((entry) => entry.date)).toEqual([dayKey(2)]);
    // The trades happened either way.
    expect(result?.journal.weeklyPnl).toBe(160);
  });

  it("speaks the weekly P&L in one currency, never a blend of two", async () => {
    const { context } = load([
      { entry_date: dayKey(0), mood: "good", pnl_amount: 500, pnl_currency: "USD" },
      { entry_date: dayKey(1), mood: "good", pnl_amount: 500, pnl_currency: "USD" },
      { entry_date: dayKey(2), mood: "good", pnl_amount: 100, pnl_currency: "GBP" },
    ]);

    // Two USD days against one GBP: USD is dominant, so the figure is the USD sum — never
    // 1100, which would be a total in neither currency.
    expect((await context)?.journal.weeklyPnl).toBe(1000);
  });

  it("counts the whole seven calendar days as the week, and stops there", async () => {
    const { context } = load([
      { entry_date: dayKey(0), mood: "good", pnl_amount: 10 },
      // Six days back is the oldest day still in the week; it used to drop out at every
      // hour but UTC midnight, because age was measured from the row's own midnight.
      { entry_date: dayKey(6), mood: "good", pnl_amount: 10 },
      { entry_date: dayKey(7), mood: "good", pnl_amount: 500 },
    ]);
    const journal = (await context)?.journal;

    expect(journal?.sessionCount).toBe(2);
    expect(journal?.weeklyPnl).toBe(20);
  });

  it("leaves soft-deleted days out of the coach's reach entirely", async () => {
    const { journal, context } = load([{ entry_date: dayKey(0), mood: "good", pnl_amount: 100 }]);
    await context;

    // The filter is the whole mechanism: a deleted day keeps its row so the importer can't
    // re-add it, so anything that forgets this reads days the trader removed.
    expect(journal.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("measures the challenge standing from the day it started, not from all-time", async () => {
    const { context } = load(
      [
        { entry_date: dayKey(1), mood: "good", pnl_amount: 100 },
        { entry_date: dayKey(20), mood: "good", pnl_amount: 900 },
      ],
      {
        firm_name: "FTMO",
        account_size: 10_000,
        account_type: "2step",
        rules: { profit_target: "10%", daily_loss_limit: "5%", max_drawdown: "10%", min_trading_days: null, max_trading_days: 30, weekend_holding: false, news_trading_allowed: true, other_rules: [], started_at: `${dayKey(2)}T09:00:00.000Z` },
      },
    );
    const challenge = (await context)?.challenge;

    // The 20-day-old £900 predates this challenge. Counted, the coach announces the £1,000
    // target reached and no days left, over a screen showing a challenge barely begun.
    expect(challenge?.cumulativePnl).toBe(100);
    expect(challenge?.daysTraded).toBe(1);
    expect(challenge?.amountToGo).toBe(900);
    expect(challenge?.daysLeft).toBe(29);
  });

  it("refuses to build a persona when the journal read fails", async () => {
    const from = vi.fn((table: string) =>
      table === "psychology_assessments"
        ? createQueryBuilder({ data: assessmentRow, error: null })
        : createQueryBuilder({ data: null, error: { message: "boom" } }),
    );

    // A failed read treated as "no data" built a coach that told a trader mid-challenge
    // they had never logged a session — and the realtime path then caches that persona.
    await expect(loadCoachContext({ from } as never, "user-1", "assessment-1", "Alex")).resolves.toBeNull();
  });
});
