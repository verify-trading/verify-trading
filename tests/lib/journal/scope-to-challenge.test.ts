import { describe, expect, it } from "vitest";

import { computeJournalAggregates, scopeToChallenge } from "@/lib/journal/contracts";

const CONNECTED = "11111111-1111-4111-8111-111111111111";
const PERSONAL = "22222222-2222-4222-8222-222222222222";

// A personal trade and a challenge trade on the SAME date. Before accounts existed these could
// not coexist at all — journal_entries was unique on (user_id, entry_date) — so a challenge
// counted whatever single row won that date.
const rows = [
  { entry_date: "2026-09-20", pnl: 100, trading_account_id: CONNECTED },
  { entry_date: "2026-09-20", pnl: -50, trading_account_id: PERSONAL },
  { entry_date: "2026-09-19", pnl: 25, trading_account_id: CONNECTED },
  { entry_date: "2026-09-01", pnl: 900, trading_account_id: CONNECTED },
  { entry_date: "2026-09-20", pnl: 7, trading_account_id: null },
];

describe("scopeToChallenge", () => {
  it("counts only the challenge account's day when two accounts share a date", () => {
    const scoped = scopeToChallenge(rows, { startedAt: "2026-09-10T00:00:00.000Z", tradingAccountId: CONNECTED });

    expect(scoped.map((row) => row.pnl)).toEqual([100, 25]);
    // The personal day survives in the journal; it just does not move challenge progress.
    expect(scoped.some((row) => row.pnl === -50)).toBe(false);
  });

  it("excludes unassigned history from an account-scoped challenge", () => {
    // Rows that predate accounts cannot be proven to belong to this account, so a challenge that
    // names one must not count them. Guessing would attribute another account's history to it.
    const scoped = scopeToChallenge(rows, { startedAt: null, tradingAccountId: CONNECTED });
    expect(scoped.every((row) => row.trading_account_id === CONNECTED)).toBe(true);
  });

  it("still applies the start date after narrowing to the account", () => {
    const scoped = scopeToChallenge(rows, { startedAt: "2026-09-10T00:00:00.000Z", tradingAccountId: CONNECTED });
    expect(scoped.some((row) => row.entry_date === "2026-09-01")).toBe(false);
  });

  it("treats a legacy challenge with no account as all-journal, not as unassigned-only", () => {
    // The trap this guards: reading null as "only rows with a null account" would have emptied
    // every existing challenge the day accounts shipped.
    const scoped = scopeToChallenge(rows, { startedAt: null, tradingAccountId: null });
    expect(scoped).toHaveLength(rows.length);
  });
});

describe("computeJournalAggregates loggedAccountDates", () => {
  const row = (entry_date: string, trading_account_id: string | null) => ({
    id: entry_date + trading_account_id, entry_date, mood: "okay", pnl_amount: "1.00",
    pnl_currency: "GBP", note: "", lesson: null, challenge_status_note: null, tags: [],
    trade_details: null, source: "broker", trading_account_id,
    created_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z",
  });

  it("tags each logged day with the account that owns it", () => {
    // Without this, "has this day been logged?" could only be answered for ALL accounts at once,
    // so the CSV importer skipped days its destination account had never seen.
    const agg = computeJournalAggregates([
      row("2026-09-20", CONNECTED), row("2026-09-20", PERSONAL),
    ] as never);

    expect(agg.loggedAccountDates).toEqual([
      `${CONNECTED}|2026-09-20`,
      `${PERSONAL}|2026-09-20`,
    ]);
    // The flat list still reports the day once per row, as it always has.
    expect(agg.loggedDates).toEqual(["2026-09-20", "2026-09-20"]);
  });

  it("gives an unassigned legacy row an empty account prefix", () => {
    const agg = computeJournalAggregates([row("2026-09-19", null)] as never);
    expect(agg.loggedAccountDates).toEqual(["|2026-09-19"]);
  });
});
