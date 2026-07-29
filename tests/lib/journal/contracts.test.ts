import { describe, expect, it } from "vitest";

import {
  computeJournalAggregates,
  isImportedRow,
  scopeToChallengeStart,
  type JournalEntryRow,
} from "@/lib/journal/contracts";

function row(overrides: Partial<JournalEntryRow>): JournalEntryRow {
  return {
    id: "row-1",
    entry_date: "2026-07-01",
    mood: "good",
    pnl_amount: 100,
    pnl_currency: "GBP",
    note: "",
    lesson: null,
    challenge_status_note: null,
    tags: [],
    trade_details: null,
    source: "mobile",
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
    ...overrides,
  } as JournalEntryRow;
}

describe("computeJournalAggregates", () => {
  // Rows arrive newest-first, which is what the streak read depends on.
  it("totals the dominant currency only, so the figure matches the symbol on it", () => {
    const aggregates = computeJournalAggregates([
      row({ id: "u1", entry_date: "2026-07-05", pnl_amount: 500, pnl_currency: "USD", source: "broker" }),
      row({ id: "u2", entry_date: "2026-07-04", pnl_amount: 500, pnl_currency: "USD", source: "broker" }),
      row({ id: "g1", entry_date: "2026-07-03", pnl_amount: 100 }),
      row({ id: "g2", entry_date: "2026-07-02", pnl_amount: 100 }),
      row({ id: "g3", entry_date: "2026-07-01", pnl_amount: 100 }),
    ]);

    // Three GBP rows against two USD ones, so GBP is dominant and the total is the GBP sum.
    // The old behaviour added all five together for 1300 and labelled it GBP anyway.
    expect(aggregates.dominantCurrency).toBe("GBP");
    expect(aggregates.totalPnl).toBe(300);
  });

  it("follows the majority when an import outnumbers what the trader typed", () => {
    const aggregates = computeJournalAggregates([
      row({ id: "u1", entry_date: "2026-07-03", pnl_amount: 400, pnl_currency: "USD", source: "broker" }),
      row({ id: "u2", entry_date: "2026-07-02", pnl_amount: 400, pnl_currency: "USD", source: "broker" }),
      row({ id: "g1", entry_date: "2026-07-01", pnl_amount: 100 }),
    ]);

    expect(aggregates.dominantCurrency).toBe("USD");
    expect(aggregates.totalPnl).toBe(800);
  });

  it("counts wins and streaks across every currency, because a win is sign-based", () => {
    const aggregates = computeJournalAggregates([
      row({ id: "u1", entry_date: "2026-07-03", pnl_amount: 500, pnl_currency: "USD" }),
      row({ id: "g1", entry_date: "2026-07-02", pnl_amount: 100 }),
      row({ id: "g2", entry_date: "2026-07-01", pnl_amount: -50 }),
    ]);

    expect(aggregates.scored).toBe(3);
    expect(aggregates.wins).toBe(2);
    expect(aggregates.streak).toEqual({ count: 2, type: "winning" });
  });

  it("treats a missing currency as GBP rather than its own bucket", () => {
    const aggregates = computeJournalAggregates([
      row({ id: "a", entry_date: "2026-07-02", pnl_amount: 10, pnl_currency: "" }),
      row({ id: "b", entry_date: "2026-07-01", pnl_amount: 10, pnl_currency: "gbp" }),
    ]);

    expect(aggregates.dominantCurrency).toBe("GBP");
    expect(aggregates.totalPnl).toBe(20);
  });
});

describe("isImportedRow", () => {
  it("is true only for the importer's own rows", () => {
    expect(isImportedRow(row({ source: "broker" }))).toBe(true);
    expect(isImportedRow(row({ source: "mobile" }))).toBe(false);
    expect(isImportedRow(row({ source: "manual" }))).toBe(false);
  });
});

describe("scopeToChallengeStart", () => {
  const rows = [row({ entry_date: "2026-07-10" }), row({ entry_date: "2026-07-05" }), row({ entry_date: "2026-06-30" })];

  it("keeps the start day itself and drops everything before it", () => {
    expect(scopeToChallengeStart(rows, "2026-07-05T09:00:00.000Z").map((r) => r.entry_date)).toEqual([
      "2026-07-10",
      "2026-07-05",
    ]);
  });

  it("grandfathers a config saved before start tracking existed to all-time", () => {
    expect(scopeToChallengeStart(rows, null)).toHaveLength(3);
  });
});
