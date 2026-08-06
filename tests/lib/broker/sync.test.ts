import { describe, expect, it } from "vitest";

import {
  computeSyncWindow,
  deriveBrokerState,
  toBrokerAccountPayload,
  toBrokerDays,
  type BrokerAccountRow,
} from "@/lib/broker/sync";
import type { MetaStatsTrade } from "@/lib/broker/metaapi";

function trade(overrides: Partial<MetaStatsTrade>): MetaStatsTrade {
  return {
    _id: "acct+1",
    accountId: "acct",
    type: "DEAL_TYPE_BUY",
    profit: 10,
    volume: 1,
    symbol: "EURUSD",
    openTime: "2026-07-01 08:00:00.000",
    closeTime: "2026-07-01 09:30:00.000",
    ...overrides,
  };
}

describe("toBrokerDays", () => {
  it("keeps only buys and sells, so deposits never become winning trades", () => {
    const days = toBrokerDays([
      trade({ _id: "a+1", profit: 25 }),
      // A $5,000 deposit arrives trade-shaped, with the cash amount in `profit`.
      trade({ _id: "a+2", type: "DEAL_TYPE_BALANCE", profit: 5000, symbol: undefined }),
      trade({ _id: "a+3", type: "DEAL_TYPE_CREDIT", profit: 100 }),
    ]);

    expect(days).toEqual([{ entryDate: "2026-07-01", pnl: 25 }]);
  });

  it("drops trades that have not closed", () => {
    expect(toBrokerDays([trade({ closeTime: undefined })])).toEqual([]);
  });

  it("groups by close date and sums profit", () => {
    const days = toBrokerDays([
      trade({ _id: "a+1", profit: 120.5, closeTime: "2026-07-01 09:30:00.000" }),
      trade({ _id: "a+2", type: "DEAL_TYPE_SELL", profit: -40.25, closeTime: "2026-07-01 15:00:00.000" }),
      trade({ _id: "a+3", profit: 12, closeTime: "2026-07-02 10:00:00.000" }),
    ]);

    expect(days).toEqual([
      { entryDate: "2026-07-01", pnl: 80.25 },
      { entryDate: "2026-07-02", pnl: 12 },
    ]);
  });

  it("counts a trade once even if MetaStats returns it on two pages", () => {
    const first = trade({ _id: "a+1", profit: 120.5 });

    // Same trade id arriving twice — a paging hiccup, not two trades.
    expect(toBrokerDays([first, { ...first }, trade({ _id: "a+2", profit: 10 })])).toEqual([
      { entryDate: "2026-07-01", pnl: 130.5 },
    ]);
  });

  it("keeps id-less trades apart rather than collapsing them into one", () => {
    const days = toBrokerDays([
      trade({ _id: undefined as never, profit: 10 }),
      trade({ _id: undefined as never, profit: 15 }),
    ]);

    expect(days).toEqual([{ entryDate: "2026-07-01", pnl: 25 }]);
  });
});

describe("computeSyncWindow", () => {
  const now = new Date("2026-07-29T03:00:00.000Z");

  it("reaches back 30 days on the first sync", () => {
    const { start, end } = computeSyncWindow({ last_synced_at: null, last_sync_error: null }, now);

    // Midnight, not the current time of day: the oldest day has to be whole, and it is
    // never re-read.
    expect(start.toISOString()).toBe("2026-06-29T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-30T03:00:00.000Z");
  });

  it("overlaps the previous sync by a day so boundary trades are picked up", () => {
    const { start } = computeSyncWindow(
      { last_synced_at: "2026-07-28T02:05:00.000Z", last_sync_error: null },
      now,
    );

    // Midnight on the day before the last sync — a trade that closed late on the 27th
    // and only settled after the run is inside the next window.
    expect(start.toISOString()).toBe("2026-07-27T00:00:00.000Z");
  });

  it("re-pulls the full window when the last attempt failed", () => {
    const { start } = computeSyncWindow(
      { last_synced_at: "2026-07-28T02:05:00.000Z", last_sync_error: "broker said no" },
      now,
    );

    expect(start.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });
});

describe("deriveBrokerState", () => {
  it("reads a parked account as ready — that is the resting state, not a fault", () => {
    expect(
      deriveBrokerState({ configured: true, state: "UNDEPLOYED", connectionStatus: "DISCONNECTED" }),
    ).toEqual({ state: "ready", stateDetail: null });
  });

  it("reads a live connected account as ready", () => {
    expect(
      deriveBrokerState({ configured: true, state: "DEPLOYED", connectionStatus: "CONNECTED" }),
    ).toEqual({ state: "ready", stateDetail: null });
  });

  it("reads a deploying account as linking", () => {
    expect(
      deriveBrokerState({ configured: true, state: "DEPLOYING", connectionStatus: "DISCONNECTED" }),
    ).toEqual({ state: "linking", stateDetail: null });
  });

  it("reads a mid-teardown account as linking, so nothing deploys against it", () => {
    for (const state of ["UNDEPLOYING", "DELETING"]) {
      expect(deriveBrokerState({ configured: true, state, connectionStatus: "DISCONNECTED" })).toEqual({
        state: "linking",
        stateDetail: null,
      });
    }
  });

  it("reads a deployed but not-yet-connected account as linking", () => {
    expect(
      deriveBrokerState({ configured: true, state: "DEPLOYED", connectionStatus: "DISCONNECTED" }),
    ).toEqual({ state: "linking", stateDetail: null });
  });

  it("reads an unconfigured account as awaiting_config whatever it is doing", () => {
    expect(
      deriveBrokerState({ configured: false, state: "DRAFT", connectionStatus: "DISCONNECTED" }),
    ).toEqual({ state: "awaiting_config", stateDetail: null });
  });

  it("reads a configured-but-still-DRAFT account as linking, so nothing deploys against it", () => {
    // `configured` is true here because the account carries a login — MetaApi has the
    // credentials but has not moved it out of DRAFT yet. Falling through to `ready` sent the
    // deploy branch at a DRAFT account, and a deployment is billed per attempt.
    expect(deriveBrokerState({ configured: true, state: "DRAFT", connectionStatus: "DISCONNECTED" })).toEqual({
      state: "linking",
      stateDetail: null,
    });
  });

  it("reads a broker-rejected login as an error the trader can act on", () => {
    const derived = deriveBrokerState({
      configured: true,
      state: "DEPLOYED",
      connectionStatus: "DISCONNECTED_FROM_BROKER",
    });

    expect(derived.state).toBe("error");
    expect(derived.stateDetail).toMatch(/investor password/i);
  });

  it("reads a failed deploy as an error", () => {
    const derived = deriveBrokerState({
      configured: true,
      state: "DEPLOY_FAILED",
      connectionStatus: "DISCONNECTED",
    });

    expect(derived.state).toBe("error");
    expect(derived.stateDetail).toBeTruthy();
  });
});

describe("toBrokerAccountPayload", () => {
  // Stamped before the copy change; the new wording is "...Update the investor password and
  // sync again." Matching the constant by equality would read this as "not rejected", and the
  // wake pass would re-pay to prove a login the broker already refused.
  const LEGACY_REJECTION = "Your broker turned the login away. Check the investor password and reconnect.";

  function rowWith(last_sync_error: string | null): BrokerAccountRow {
    return {
      id: "row-1",
      user_id: "user-1",
      metaapi_account_id: "meta-1",
      platform: "mt5",
      region: "london",
      last_synced_at: null,
      last_sync_error,
      created_at: "2026-07-01T00:00:00.000Z",
    };
  }

  it("reads credentialsRejected from the legacy wording, wherever the stamp lives", () => {
    // The stamp reaches the payload two ways: the sync-failure field on the row, or the
    // derived state detail from a live snapshot. Both have to match legacy text.
    expect(
      toBrokerAccountPayload(rowWith(LEGACY_REJECTION), { state: "ready", stateDetail: null }).credentialsRejected,
    ).toBe(true);
    expect(
      toBrokerAccountPayload(rowWith(null), { state: "error", stateDetail: LEGACY_REJECTION }).credentialsRejected,
    ).toBe(true);
  });

  it("reads credentialsRejected from the current wording too", () => {
    const current = "Your broker turned the login away. Update the investor password and sync again.";
    expect(toBrokerAccountPayload(rowWith(current), { state: "ready", stateDetail: null }).credentialsRejected).toBe(
      true,
    );
  });

  it("reads an unrelated sync error as not rejected", () => {
    expect(
      toBrokerAccountPayload(rowWith("broker said no"), { state: "error", stateDetail: "broker said no" })
        .credentialsRejected,
    ).toBe(false);
  });
});
