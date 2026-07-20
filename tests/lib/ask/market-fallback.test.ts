import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Control the provider + shared-cache boundary so the fallback can be exercised without a
// TWELVE_DATA_API_KEY or Supabase config (which the plain market.test.ts env lacks, hence its
// FMP-only paths). MARKET_CATEGORIES stays real — market-providers derives its symbol map from it.
vi.mock("@/lib/markets/twelve-data-adapter", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/markets/twelve-data-adapter")>();
  return {
    ...actual,
    fetchQuotes: vi.fn(),
    fetchMarketSeries: vi.fn(),
    readCacheRow: vi.fn(),
    upsertCache: vi.fn(),
  };
});

import { clearMarketCaches, getMarketQuote, type MarketQuote } from "@/lib/ask/market";
import { fetchQuotes, readCacheRow, upsertCache, type TwelveDataQuote } from "@/lib/markets/twelve-data-adapter";

const mockedFetchQuotes = vi.mocked(fetchQuotes);
const mockedReadCacheRow = vi.mocked(readCacheRow);
const mockedUpsert = vi.mocked(upsertCache);

function tdQuote(overrides: Partial<TwelveDataQuote>): TwelveDataQuote {
  return {
    symbol: "XAU/USD",
    name: "Gold Spot / US Dollar",
    price: 4005.89,
    change: 29.11,
    percent_change: 0.73,
    open: 3976,
    high: 4022,
    low: 3961,
    previous_close: 3976,
    is_market_open: true,
    exchange: "Forex",
    ...overrides,
  };
}

function fmpResponse(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
}

describe("Ask market provider fallback", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.FMP_API_KEY;

  beforeEach(() => {
    process.env.FMP_API_KEY = "test-key";
    clearMarketCaches();
    vi.clearAllMocks();
    mockedReadCacheRow.mockResolvedValue(null);
    mockedUpsert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.FMP_API_KEY;
    else process.env.FMP_API_KEY = originalApiKey;
  });

  it("serves Gold from Twelve Data (which FMP's plan blocks) without touching FMP", async () => {
    mockedFetchQuotes.mockResolvedValue([tdQuote({ price: 4005.89, percent_change: 0.73 })]);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4005.89);
    expect(quote.changePercent).toBe(0.73);
    expect(quote.direction).toBe("up");
    expect(mockedFetchQuotes).toHaveBeenCalledWith(["XAU/USD"]); // GCUSD → XAU/USD alias
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to FMP when Twelve Data is rate-limited", async () => {
    mockedFetchQuotes.mockRejectedValue(new Error("429 too many requests"));
    global.fetch = vi.fn().mockResolvedValue(fmpResponse([{ price: 1.3453, changePercentage: -0.17 }])) as unknown as typeof fetch;

    const quote = await getMarketQuote("GBP/USD");

    expect(quote.price).toBe(1.3453);
    expect(quote.direction).toBe("down");
    expect(global.fetch).toHaveBeenCalledTimes(1); // FMP quote only
  });

  it("falls back to FMP when Twelve Data returns a zero/empty price", async () => {
    mockedFetchQuotes.mockResolvedValue([tdQuote({ price: 0 })]);
    global.fetch = vi.fn().mockResolvedValue(fmpResponse([{ price: 4493.2, changePercentage: 1.1 }])) as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4493.2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("serves a fresh server-cache row without calling any provider", async () => {
    const cached: MarketQuote = { asset: "Gold", symbol: "GCUSD", price: 4000, changePercent: 0.5, direction: "up", isMarketOpen: null };
    mockedReadCacheRow.mockResolvedValue({ payload: cached, fetchedAt: new Date().toISOString() });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4000);
    expect(mockedFetchQuotes).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores a stale server-cache row and refetches", async () => {
    const stale: MarketQuote = { asset: "Gold", symbol: "GCUSD", price: 1, changePercent: 0, direction: "up", isMarketOpen: null };
    mockedReadCacheRow.mockResolvedValue({ payload: stale, fetchedAt: new Date(Date.now() - 10 * 60_000).toISOString() });
    mockedFetchQuotes.mockResolvedValue([tdQuote({ price: 4005.89 })]);
    global.fetch = vi.fn() as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4005.89);
    expect(mockedUpsert).toHaveBeenCalled(); // fresh value written back
  });
});
