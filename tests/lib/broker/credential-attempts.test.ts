import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  checkCredentialAttempt,
  claimBrokerCreate,
  refundBrokerCreate,
  refundCredentialAttempt,
} from "@/lib/broker/credential-attempts";

// The limiter keeps its windows in module state with no reset hook, so each test keys on its
// own user id — a shared one would make the tests order-dependent instead of self-contained.
describe("checkCredentialAttempt", () => {
  beforeEach(() => {
    // The window is measured in Date.now() ticks, so the tests advance a fake clock rather
    // than sleeping ten minutes of real time.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets five attempts through and blocks the sixth", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkCredentialAttempt("user-1")).toBe(true);
    }
    expect(checkCredentialAttempt("user-1")).toBe(false);
  });

  it("slides the window — the budget returns ten minutes after the oldest attempt", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkCredentialAttempt("user-2")).toBe(true);
    }
    expect(checkCredentialAttempt("user-2")).toBe(false);

    // Half the window gone: the earliest attempt has not expired yet, so still blocked.
    vi.setSystemTime(new Date("2026-08-04T10:05:00.000Z"));
    expect(checkCredentialAttempt("user-2")).toBe(false);

    // Just past the window every attempt is expired, and the blocked call never recorded
    // itself — so the budget is five again, not four. (A blocked attempt that counted
    // itself would push its own window open-ended under hammering.)
    vi.setSystemTime(new Date("2026-08-04T10:10:01.000Z"));
    expect(checkCredentialAttempt("user-2")).toBe(true);
    expect(checkCredentialAttempt("user-2")).toBe(true);
  });

  it("hands back an attempt that never reached MetaApi", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkCredentialAttempt("user-5")).toBe(true);
    }
    expect(checkCredentialAttempt("user-5")).toBe(false);

    // The route refunds when it answers without spending — "you already have one connected".
    // Without this the trader is locked out for ten minutes over unbillable requests.
    refundCredentialAttempt("user-5");
    expect(checkCredentialAttempt("user-5")).toBe(true);
    expect(checkCredentialAttempt("user-5")).toBe(false);

    // Refunding a user who never attempted anything must not hand out free budget.
    refundCredentialAttempt("user-6");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkCredentialAttempt("user-6")).toBe(true);
    }
    expect(checkCredentialAttempt("user-6")).toBe(false);
  });

  it("keeps different users' budgets apart", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(checkCredentialAttempt("user-3")).toBe(true);
    }
    expect(checkCredentialAttempt("user-3")).toBe(false);
    // One account's retry loop must not 429 the trader next door.
    expect(checkCredentialAttempt("user-4")).toBe(true);
  });
});

/**
 * The $2.10 brake. This one is durable on purpose — the map above is per warm serverless
 * instance, which a loop across cold starts walks straight through — so what the stub below
 * stands in for is the table, not a counter.
 */
describe("claimBrokerCreate", () => {
  /**
   * The two calls the budget makes and nothing else: a count of this user's rows inside the
   * window, then the row recording this attempt. Rows are kept in an array so the count is a
   * real consequence of what was recorded rather than a scripted number.
   */
  function stubCreateEvents(failure?: "count" | "insert") {
    const rows: Array<{ id: number; user_id: string }> = [];
    const filters: Array<[string, unknown]> = [];
    let nextId = 1;
    const admin = {
      from: (table: string) => {
        expect(table).toBe("broker_create_events");
        const builder: Record<string, unknown> = {};
        let user = "";
        let deleting = false;
        builder.select = () => builder;
        builder.order = () => builder;
        builder.limit = () => builder;
        builder.delete = () => {
          deleting = true;
          return builder;
        };
        builder.eq = (column: string, value: unknown) => {
          if (column === "user_id") user = String(value);
          // The delete filters on the id the select handed back, so this is where a refund
          // actually removes the row — the whole point of the id column.
          if (deleting && column === "id") {
            const index = rows.findIndex((row) => row.id === value);
            if (index >= 0) rows.splice(index, 1);
          }
          return builder;
        };
        builder.gt = (column: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        };
        builder.insert = (row: { user_id: string }) => {
          if (failure !== "insert") rows.push({ id: nextId++, user_id: row.user_id });
          return Promise.resolve({ error: failure === "insert" ? { message: "no such table" } : null });
        };
        // Newest first, which is what the refund's order + limit asks for.
        builder.maybeSingle = () =>
          Promise.resolve({ data: [...rows].reverse().find((row) => row.user_id === user) ?? null, error: null });
        builder.then = (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve(
            failure === "count"
              ? { count: null, error: { message: 'relation "broker_create_events" does not exist' } }
              : { count: rows.filter((row) => row.user_id === user).length, error: null },
          ).then(onFulfilled);
        return builder;
      },
    } as unknown as SupabaseClient;
    return { admin, rows, filters };
  }

  it("lets three creates through in a day and refuses the fourth", async () => {
    const { admin, rows } = stubCreateEvents();

    for (let create = 1; create <= 3; create += 1) {
      await expect(claimBrokerCreate(admin, "user-1")).resolves.toBe(true);
    }
    // Switching broker twice in a day with a mistake in between is the legitimate ceiling.
    // A fourth is a loop, and at $2.10 each that is the difference worth stopping.
    await expect(claimBrokerCreate(admin, "user-1")).resolves.toBe(false);
    expect(rows).toHaveLength(3);
  });

  it("does not record a refused create, so the budget still comes back", async () => {
    const { admin, rows } = stubCreateEvents();
    for (let create = 1; create <= 3; create += 1) await claimBrokerCreate(admin, "user-2");

    await claimBrokerCreate(admin, "user-2");
    await claimBrokerCreate(admin, "user-2");

    // Recording refusals would let hammering push its own window open-ended — the trader who
    // hit the ceiling at noon would never get their budget back.
    expect(rows.filter((row) => row.user_id === "user-2")).toHaveLength(3);
  });

  it("hands back the create MetaApi refused, so typos don't cost a day", async () => {
    const { admin, rows } = stubCreateEvents();
    for (let create = 1; create <= 3; create += 1) await claimBrokerCreate(admin, "user-8");
    await expect(claimBrokerCreate(admin, "user-8")).resolves.toBe(false);

    // A wrong investor password costs $0.105 and creates nothing — the attempt budget's
    // business, not this one's. The row that comes off is the newest, the one just claimed.
    await refundBrokerCreate(admin, "user-8");

    expect(rows.filter((row) => row.user_id === "user-8")).toHaveLength(2);
    await expect(claimBrokerCreate(admin, "user-8")).resolves.toBe(true);
  });

  it("refunds only the refunding user's newest create", async () => {
    const { admin, rows } = stubCreateEvents();
    await claimBrokerCreate(admin, "user-9");
    await claimBrokerCreate(admin, "user-10");

    await refundBrokerCreate(admin, "user-9");

    // The neighbour's row survives: "newest overall" would have taken theirs.
    expect(rows.map((row) => row.user_id)).toEqual(["user-10"]);
  });

  it("says nothing when there is no create to refund", async () => {
    const { admin, rows } = stubCreateEvents();

    await expect(refundBrokerCreate(admin, "user-11")).resolves.toBeUndefined();
    expect(rows).toHaveLength(0);
  });

  it("counts one user's creates against that user only", async () => {
    const { admin } = stubCreateEvents();
    for (let create = 1; create <= 3; create += 1) await claimBrokerCreate(admin, "user-3");

    await expect(claimBrokerCreate(admin, "user-3")).resolves.toBe(false);
    await expect(claimBrokerCreate(admin, "user-4")).resolves.toBe(true);
  });

  it("counts over a rolling day, not a calendar one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T10:00:00.000Z"));
    const { admin, filters } = stubCreateEvents();

    await claimBrokerCreate(admin, "user-5");

    // The window is a predicate the database applies, so this is the only place it is visible.
    // A calendar day would hand out a fresh three at midnight, right where a loop would wait.
    expect(filters).toEqual([["created_at", "2026-08-03T10:00:00.000Z"]]);
    vi.useRealTimers();
  });

  it("falls back to the in-memory brake rather than blocking connect when the table is missing", async () => {
    // This ships before its migration is applied. A brake that throws would take connecting
    // down for everyone the moment the table is unreachable, which is worse than the leak it
    // exists to close — the in-memory budget still covers a loop hitting one warm instance.
    const { admin } = stubCreateEvents("count");

    await expect(claimBrokerCreate(admin, "user-6")).resolves.toBe(true);
  });

  it("lets a create through that could not be recorded", async () => {
    // Same reasoning one step later: the count worked, the insert did not. Refusing here would
    // block a paying trader over our bookkeeping, and one unrecorded create is not the loop.
    const { admin } = stubCreateEvents("insert");

    await expect(claimBrokerCreate(admin, "user-7")).resolves.toBe(true);
  });
});
