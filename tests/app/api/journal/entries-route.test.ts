import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/journal/ai", () => ({
  generateChallengeStatus: vi.fn(),
  overheatTrigger: vi.fn(() => null),
}));

import { GET, POST } from "@/app/api/journal/entries/route";
import { getSessionUser } from "@/lib/auth/session";
import { generateChallengeStatus } from "@/lib/journal/ai";

// Chainable thenable stand-in for a PostgREST query: every builder method returns the
// builder, and awaiting it (or .single()/.maybeSingle()) resolves the provided result. A
// filter method added in src must be added here too, or the chain returns undefined mid-query.
function createQueryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder = {} as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;

  for (const method of ["select", "eq", "is", "order", "limit", "insert", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

describe("Journal entries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session to list journal entries", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/journal/entries"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
      message: "Sign in to load journal entries.",
    });
  });

  it("lists user-owned journal entries", async () => {
    const row = {
      id: "entry-1",
      entry_date: "2026-05-26",
      mood: "good",
      pnl_amount: "180.00",
      pnl_currency: "GBP",
      note: "Waited for confirmation.",
      lesson: "Patience is the edge.",
      challenge_status_note: null,
      tags: ["london"],
      trade_details: null,
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const builder = createQueryBuilder({ data: [row], error: null });
    const from = vi.fn(() => builder);

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await GET(new Request("http://localhost/api/journal/entries?limit=10"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("journal_entries");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(json.entries).toEqual([
      {
        id: "entry-1",
        entryDate: "2026-05-26",
        mood: "good",
        pnlAmount: 180,
        pnlCurrency: "GBP",
        note: "Waited for confirmation.",
        lesson: "Patience is the edge.",
        challengeStatusNote: null,
        tags: ["london"],
        tradeDetails: null,
        createdAt: "2026-05-26T12:00:00.000Z",
        updatedAt: "2026-05-26T12:00:00.000Z",
      },
    ]);
  });

  it("rejects an invalid journal entry body", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from: vi.fn() },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({ entryDate: "2026-05-26", mood: "angry" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "journal_entry_invalid",
      message: "The journal entry request body is invalid.",
    });
  });

  it("creates a journal entry for the signed-in user", async () => {
    const row = {
      id: "entry-1",
      entry_date: "2026-05-26",
      mood: "okay",
      pnl_amount: "-25.00",
      pnl_currency: "GBP",
      note: "Choppy NY session.",
      lesson: null,
      challenge_status_note: null,
      tags: [],
      created_at: "2026-05-26T12:00:00.000Z",
      updated_at: "2026-05-26T12:00:00.000Z",
    };
    const savedBuilder = createQueryBuilder({ data: row, error: null });
    const entriesBuilder = createQueryBuilder({ data: [row], error: null });
    const configBuilder = createQueryBuilder({ data: null, error: null });
    let journalCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "journal_entries") journalCallCount += 1;
      if (table === "journal_entries" && journalCallCount === 1) return savedBuilder;
      if (table === "journal_entries") return entriesBuilder;
      if (table === "challenge_config") return configBuilder;
      return createQueryBuilder({ data: null, error: null });
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({
          entryDate: "2026-05-26",
          mood: "okay",
          pnlAmount: -25,
          note: "Choppy NY session.",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(savedBuilder.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      entry_date: "2026-05-26",
      mood: "okay",
      pnl_amount: -25,
      pnl_currency: "GBP",
      source: "mobile",
    }), { onConflict: "user_id,entry_date" });
  });

  it("stamps a CSV import as source 'csv' instead of leaving it to the tags", async () => {
    // The CSV importer posts through this same route, so without this the only thing marking an
    // imported day was a client-supplied tag — and every reader that must exclude imported days
    // had to select the tags column to find out.
    const savedBuilder = createQueryBuilder({ data: null, error: { message: "stop here" } });
    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from: vi.fn(() => savedBuilder) },
    } as never);

    await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({
          entryDate: "2026-05-26",
          mood: "okay",
          pnlAmount: 40,
          tags: ["csv", "csv:1754"],
        }),
      }),
    );

    expect(savedBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "csv", tags: ["csv", "csv:1754"] }),
      { onConflict: "user_id,entry_date" },
    );
  });

  it("tells the coaching note only about the days inside the current challenge", async () => {
    vi.mocked(generateChallengeStatus).mockResolvedValue("Keep the size you traded today.");
    const saved = {
      id: "entry-1",
      entry_date: "2026-07-29",
      mood: "good",
      pnl_amount: "100.00",
      pnl_currency: "GBP",
      note: "",
      lesson: null,
      challenge_status_note: null,
      tags: [],
      trade_details: null,
      source: "mobile",
      created_at: "2026-07-29T12:00:00.000Z",
      updated_at: "2026-07-29T12:00:00.000Z",
    };
    // Newest-first history: today's £100, a journaled day with no trade on it, and £900
    // earned weeks BEFORE this challenge was configured.
    const recent = [
      saved,
      { ...saved, id: "entry-2", entry_date: "2026-07-28", pnl_amount: null },
      { ...saved, id: "entry-3", entry_date: "2026-07-01", pnl_amount: "900.00" },
    ];
    const savedBuilder = createQueryBuilder({ data: saved, error: null });
    const recentBuilder = createQueryBuilder({ data: recent, error: null });
    const noteBuilder = createQueryBuilder({ data: { ...saved, challenge_status_note: "Keep the size you traded today." }, error: null });
    const configBuilder = createQueryBuilder({
      data: {
        id: "config-1",
        firm_name: "FTMO",
        firm_url: "https://ftmo.com",
        account_size: 10_000,
        account_type: "2step",
        rules: { profit_target: "10%", daily_loss_limit: "5%", max_drawdown: "10%", min_trading_days: null, max_trading_days: 30, weekend_holding: false, news_trading_allowed: true, other_rules: [], started_at: "2026-07-28T09:00:00.000Z" },
        created_at: "2026-07-28T09:00:00.000Z",
        updated_at: "2026-07-28T09:00:00.000Z",
      },
      error: null,
    });
    let journalCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "challenge_config") return configBuilder;
      if (table !== "journal_entries") return createQueryBuilder({ data: null, error: null });
      journalCallCount += 1;
      if (journalCallCount === 1) return savedBuilder; // the upsert
      if (journalCallCount === 2) return recentBuilder; // the recent-history read
      return noteBuilder; // writing the note back onto the entry
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      user: { id: "user-1" },
      supabase: { from },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/journal/entries", {
        method: "POST",
        body: JSON.stringify({ entryDate: "2026-07-29", mood: "good", pnlAmount: 100 }),
      }),
    );

    expect(response.status).toBe(201);
    // The prompt calls these "this evaluation": pre-challenge history would have handed the
    // coach £1,000 of a £1,000 target, and counted a no-trade day as a day traded.
    expect(generateChallengeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ cumulativePnl: 100, daysTraded: 1 }),
    );
  });
});
