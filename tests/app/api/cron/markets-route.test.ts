import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/markets/twelve-data-adapter", () => ({
  MARKET_CATEGORIES: {
    major_pairs: { symbols: ["EUR/USD", "AUD/USD"] },
    commodities: { symbols: ["XAU/USD"] },
    crypto: { symbols: ["BTC/USD"] },
  },
  fetchMarketSeries: vi.fn(),
  fetchMarketState: vi.fn(),
  fetchQuotes: vi.fn(),
  readCacheRow: vi.fn(),
  upsertCache: vi.fn(),
}));

vi.mock("@/lib/markets/newsdata-market-intelligence", () => ({
  getMarketIntelligenceSnapshot: vi.fn(),
}));

vi.mock("@/lib/markets/rapidapi-economic-calendar", () => ({
  ECONOMIC_CALENDAR_CACHE_KEY: "events:economic:week",
  getEconomicCalendarWeekSnapshot: vi.fn(),
  shouldRefreshEconomicCalendar: vi.fn(),
}));

import { GET } from "@/app/api/cron/markets/route";
import { getMarketIntelligenceSnapshot } from "@/lib/markets/newsdata-market-intelligence";
import {
  getEconomicCalendarWeekSnapshot,
  shouldRefreshEconomicCalendar,
} from "@/lib/markets/rapidapi-economic-calendar";
import {
  fetchMarketSeries,
  fetchMarketState,
  fetchQuotes,
  readCacheRow,
  upsertCache,
} from "@/lib/markets/twelve-data-adapter";

describe("GET /api/cron/markets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("skips provider calls when the current 5-minute window already updated quotes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(readCacheRow).mockImplementation(async (key: string) => {
      if (key === "quotes:all") {
        return {
          fetchedAt: new Date(5 * 60 * 1000).toISOString(),
          payload: {
            quotes: {
              "EUR/USD": { symbol: "EUR/USD" },
              "AUD/USD": { symbol: "AUD/USD" },
              "XAU/USD": { symbol: "XAU/USD" },
              "BTC/USD": { symbol: "BTC/USD" },
            },
          },
        } as never;
      }
      return null;
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.actions).toEqual(["skipped:quotes-cache-current-window"]);
    expect(json.skipReason).toBe("quotes-cache-current-window");
    expect(fetchMarketState).not.toHaveBeenCalled();
    expect(fetchQuotes).not.toHaveBeenCalled();
    expect(fetchMarketSeries).not.toHaveBeenCalled();
    expect(upsertCache).toHaveBeenCalledWith(
      "cron:markets:last-run",
      expect.objectContaining({
        ok: true,
        actions: ["skipped:quotes-cache-current-window"],
        skipReason: "quotes-cache-current-window",
      }),
    );
  });

  it("does not skip when the current quote cache is missing configured symbols", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(fetchQuotes).mockResolvedValue([
      { symbol: "EUR/USD", price: 1.1, percent_change: 0.5 },
      { symbol: "AUD/USD", price: 0.7, percent_change: 0.2 },
      { symbol: "XAU/USD", price: 2300, percent_change: -0.1 },
      { symbol: "BTC/USD", price: 80000, percent_change: 1.2 },
    ] as never);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(false);
    vi.mocked(readCacheRow).mockImplementation(async (key: string) => {
      if (key === "quotes:all") {
        return {
          fetchedAt: new Date(5 * 60 * 1000).toISOString(),
          payload: { quotes: { "EUR/USD": { symbol: "EUR/USD" } } },
        } as never;
      }
      return {
        fetchedAt: new Date(5 * 60 * 1000).toISOString(),
        payload: { updatedAt: new Date(5 * 60 * 1000).toISOString(), items: [] },
      } as never;
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actions).not.toContain("skipped:quotes-cache-current-window");
    expect(fetchQuotes).toHaveBeenCalledWith(["EUR/USD", "AUD/USD", "XAU/USD", "BTC/USD"]);
  });

  it("refreshes all quotes and the selected-detail timeframe on every run", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: new Date(0).toISOString(),
      payload: { updatedAt: new Date(0).toISOString(), items: [] },
    } as never);
    vi.mocked(fetchQuotes).mockResolvedValue([
      { symbol: "EUR/USD", price: 1.1, percent_change: 0.5 },
      { symbol: "AUD/USD", price: 0.7, percent_change: 0.2 },
      { symbol: "XAU/USD", price: 2300, percent_change: -0.1 },
      { symbol: "BTC/USD", price: 80000, percent_change: 1.2 },
    ] as never);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/cron/markets"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.errors).toEqual([]);
    expect(fetchQuotes).toHaveBeenCalledWith(["EUR/USD", "AUD/USD", "XAU/USD", "BTC/USD"]);
    expect(fetchMarketSeries).toHaveBeenCalledTimes(4);
    expect(getMarketIntelligenceSnapshot).not.toHaveBeenCalled();

    const quotesWrite = vi
      .mocked(upsertCache)
      .mock.calls.find(([key]) => key === "quotes:all");
    expect(quotesWrite?.[1]).toEqual({
      quotes: {
        "EUR/USD": { symbol: "EUR/USD", price: 1.1, percent_change: 0.5 },
        "AUD/USD": { symbol: "AUD/USD", price: 0.7, percent_change: 0.2 },
        "XAU/USD": { symbol: "XAU/USD", price: 2300, percent_change: -0.1 },
        "BTC/USD": { symbol: "BTC/USD", price: 80000, percent_change: 1.2 },
      },
    });
    expect(upsertCache).toHaveBeenCalledWith(
      "cron:markets:last-run",
      expect.objectContaining({
        ok: true,
        actions: expect.arrayContaining(["marketState:0", "quotes:4/4", "series:1D:4/4"]),
        errors: [],
        startedAt: expect.any(String),
        finishedAt: expect.any(String),
        durationMs: expect.any(Number),
        nextSeries: "1D refreshed",
      }),
    );
  });

  it("merges refreshed quotes with existing cached symbols", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(fetchQuotes).mockResolvedValue([
      { symbol: "EUR/USD", price: 1.1, percent_change: 0.5 },
      { symbol: "AUD/USD", price: 0.7, percent_change: 0.2 },
      { symbol: "XAU/USD", price: 2300, percent_change: -0.1 },
      { symbol: "BTC/USD", price: 80000, percent_change: 1.2 },
    ] as never);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(false);
    vi.mocked(readCacheRow).mockImplementation(async (key: string) => {
      if (key === "quotes:all") {
        return {
          fetchedAt: new Date(0).toISOString(),
          payload: { quotes: { QQQ: { symbol: "QQQ", price: 700 } } },
        } as never;
      }
      return {
        fetchedAt: new Date(0).toISOString(),
        payload: { updatedAt: new Date(0).toISOString(), items: [] },
      } as never;
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));

    expect(response.status).toBe(200);
    const quotesWrite = vi
      .mocked(upsertCache)
      .mock.calls.find(([key]) => key === "quotes:all");
    expect(quotesWrite?.[1]).toEqual({
      quotes: expect.objectContaining({
        QQQ: { symbol: "QQQ", price: 700 },
        "EUR/USD": { symbol: "EUR/USD", price: 1.1, percent_change: 0.5 },
      }),
    });
  });

  it("refreshes market intelligence when the shared cache is stale", async () => {
    vi.spyOn(Date, "now").mockReturnValue(60 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: new Date(0).toISOString(),
      payload: { updatedAt: new Date(0).toISOString(), items: [] },
    } as never);
    vi.mocked(fetchQuotes).mockResolvedValue([]);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(false);
    vi.mocked(getMarketIntelligenceSnapshot).mockResolvedValue({
      updatedAt: "2026-05-05T10:00:00.000Z",
      items: [
        {
          id: "n1",
          title: "Dollar steadies",
          source: "NewsData",
          publishedAt: "2026-05-05T09:00:00.000Z",
          summary: "Markets wait.",
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));

    expect(response.status).toBe(200);
    expect(upsertCache).toHaveBeenCalledWith("intelligence:news", {
      updatedAt: "2026-05-05T10:00:00.000Z",
      items: [
        {
          id: "n1",
          title: "Dollar steadies",
          source: "NewsData",
          publishedAt: "2026-05-05T09:00:00.000Z",
          summary: "Markets wait.",
        },
      ],
    });
  });

  it("refreshes one selected-detail timeframe and keeps existing symbols on failures", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(readCacheRow).mockImplementation(async (key: string) => {
      if (key === "series:1W") {
        return {
          fetchedAt: new Date(0).toISOString(),
          payload: { series: { "AUD/USD": [0.7, 0.72] } },
        } as never;
      }
      return {
        fetchedAt: new Date(0).toISOString(),
        payload: { updatedAt: new Date(0).toISOString(), items: [] },
      } as never;
    });
    vi.mocked(fetchQuotes).mockResolvedValue([]);
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(false);
    vi.mocked(fetchMarketSeries).mockImplementation(async (symbol: string) => {
      if (symbol === "AUD/USD") {
        throw new Error("temporary symbol failure");
      }
      return { symbol, values: [1, 2, 3] };
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("series-symbol:temporary symbol failure")]),
    );
    expect(fetchMarketSeries).toHaveBeenCalledWith("EUR/USD", "1W");
    expect(upsertCache).toHaveBeenCalledWith("series:1W", {
      timeframe: "1W",
      series: {
        "AUD/USD": [0.7, 0.72],
        "EUR/USD": [1, 2, 3],
        "XAU/USD": [1, 2, 3],
        "BTC/USD": [1, 2, 3],
      },
    });
  });

  it("refreshes the weekly economic calendar when its cache is stale", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2 * 60 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: new Date(0).toISOString(),
      payload: { updatedAt: new Date(0).toISOString(), dayLabel: "old", items: [] },
    } as never);
    vi.mocked(fetchQuotes).mockResolvedValue([]);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(true);
    vi.mocked(getEconomicCalendarWeekSnapshot).mockResolvedValue({
      updatedAt: "2026-05-05T10:00:00.000Z",
      from: "2026-05-05",
      to: "2026-05-12",
      countries: ["US", "CN"],
      dayLabel: "Upcoming events",
      items: [
        {
          id: "event-1",
          timeUtc: "2026-05-05T14:00:00.000Z",
          timeLabel: "14:00 UTC",
          country: "US",
          currency: "USD",
          event: "ISM N-Mfg PMI",
          impact: "high",
          actual: "53.6",
          forecast: "53.7",
          previous: "54",
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));

    expect(response.status).toBe(200);
    expect(upsertCache).toHaveBeenCalledWith("events:economic:week", {
      updatedAt: "2026-05-05T10:00:00.000Z",
      from: "2026-05-05",
      to: "2026-05-12",
      countries: ["US", "CN"],
      dayLabel: "Upcoming events",
      items: [
        {
          id: "event-1",
          timeUtc: "2026-05-05T14:00:00.000Z",
          timeLabel: "14:00 UTC",
          country: "US",
          currency: "USD",
          event: "ISM N-Mfg PMI",
          impact: "high",
          actual: "53.6",
          forecast: "53.7",
          previous: "54",
        },
      ],
    });
  });

  it("keeps the cron successful when the economic calendar provider fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(60 * 60 * 1000);
    vi.stubEnv("CRON_SECRET", "");
    vi.mocked(fetchMarketState).mockResolvedValue([]);
    vi.mocked(readCacheRow).mockResolvedValue({
      fetchedAt: new Date(0).toISOString(),
      payload: { updatedAt: new Date(0).toISOString(), dayLabel: "old", items: [] },
    } as never);
    vi.mocked(fetchQuotes).mockResolvedValue([]);
    vi.mocked(fetchMarketSeries).mockResolvedValue({ symbol: "EUR/USD", values: [1, 2, 3] });
    vi.mocked(shouldRefreshEconomicCalendar).mockReturnValue(true);
    vi.mocked(getEconomicCalendarWeekSnapshot).mockRejectedValue(new Error("provider down"));
    vi.mocked(getMarketIntelligenceSnapshot).mockResolvedValue({
      updatedAt: "2026-05-05T10:00:00.000Z",
      items: [],
    });

    const response = await GET(new Request("http://localhost/api/cron/markets"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actions).toContain("economicCalendar:error");
    expect(json.errors).toEqual(expect.arrayContaining(["economicCalendar:provider down"]));
    expect(upsertCache).not.toHaveBeenCalledWith("events:economic:week", expect.anything());
    expect(upsertCache).toHaveBeenCalledWith("intelligence:news", {
      updatedAt: "2026-05-05T10:00:00.000Z",
      items: [],
    });
    expect(upsertCache).toHaveBeenCalledWith(
      "cron:markets:last-run",
      expect.objectContaining({
        ok: true,
        actions: expect.arrayContaining(["economicCalendar:error"]),
        errors: expect.arrayContaining(["economicCalendar:provider down"]),
      }),
    );
  });
});
