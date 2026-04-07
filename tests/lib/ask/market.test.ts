import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMarketCaches,
  deriveQuoteFromSeries,
  getMarketQuote,
  getMarketSeries,
  inferMarketAssetFromText,
  resolveSupportedAsset,
} from "@/lib/ask/market";

describe("market tools", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.TWELVE_DATA_API_KEY;

  beforeEach(() => {
    process.env.TWELVE_DATA_API_KEY = "test-key";
    clearMarketCaches();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.TWELVE_DATA_API_KEY;
    } else {
      process.env.TWELVE_DATA_API_KEY = originalApiKey;
    }
  });

  it("resolves supported asset aliases", () => {
    expect(resolveSupportedAsset("Trading Gold")).toEqual(null);
    expect(resolveSupportedAsset("Gold")?.symbol).toBe("XAU/USD");
    expect(resolveSupportedAsset("XAU")?.symbol).toBe("XAU/USD");
    expect(resolveSupportedAsset("Silver")?.symbol).toBe("SLV");
    expect(resolveSupportedAsset("EUR/USD")?.asset).toBe("EUR/USD");
    expect(resolveSupportedAsset("EU")?.symbol).toBe("EUR/USD");
    expect(resolveSupportedAsset("GU")?.symbol).toBe("GBP/USD");
    expect(resolveSupportedAsset("Nasdaq")?.symbol).toBe("QQQ");
    expect(resolveSupportedAsset("NAS")?.symbol).toBe("QQQ");
    expect(resolveSupportedAsset("Dow Jones")?.symbol).toBe("DIA");
  });

  it("does not infer short aliases from incidental substrings", () => {
    expect(inferMarketAssetFromText("Should I buy this because the language sounds nascent?")).toBeNull();
    expect(inferMarketAssetFromText("This guessing game has nothing to do with cable.")).toBeNull();
    expect(inferMarketAssetFromText("I like the ethics here.")).toBeNull();
  });

  it("parses a quote response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        close: "4493.20",
        percent_change: "1.10",
        is_market_open: true,
      }),
    }) as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.asset).toBe("GOLD / XAUUSD");
    expect(quote.price).toBe(4493.2);
    expect(quote.direction).toBe("up");
  });

  it("resolves an unknown asset through symbol search before quoting", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              symbol: "SLV",
              instrument_name: "iShares Silver Trust",
              exchange: "NYSE ARCA",
              instrument_type: "ETF",
            },
          ],
          status: "ok",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          close: "28.11",
          percent_change: "0.95",
          is_market_open: false,
        }),
      }) as unknown as typeof fetch;

    const quote = await getMarketQuote("iShares Silver Trust");

    expect(quote.symbol).toBe("SLV");
    expect(quote.asset).toBe("ISHARES SILVER TRUST (SLV)");
    expect(quote.price).toBe(28.11);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("parses a time-series response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [
          { close: "4490" },
          { close: "4480" },
          { close: "4470" },
        ],
      }),
    }) as unknown as typeof fetch;

    const series = await getMarketSeries("Gold", "1W");

    expect(series.closeValues).toEqual([4470, 4480, 4490]);
    expect(series.support).toBe(4470);
    expect(series.resistance).toBe(4490);
  });

  it("sorts time-series closes by datetime when present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [
          { datetime: "2024-01-03 00:00:00", close: "4490" },
          { datetime: "2024-01-01 00:00:00", close: "4470" },
          { datetime: "2024-01-02 00:00:00", close: "4480" },
        ],
      }),
    }) as unknown as typeof fetch;

    const series = await getMarketSeries("Gold", "1W");

    expect(series.closeValues).toEqual([4470, 4480, 4490]);
  });

  it("derives a quote from a time series", () => {
    const quote = deriveQuoteFromSeries({
      asset: "GOLD / XAUUSD",
      symbol: "XAU/USD",
      timeframe: "1W",
      closeValues: [100, 100.5, 101],
      resistance: 101,
      support: 100,
    });

    expect(quote.price).toBe(101);
    expect(quote.changePercent).toBeCloseTo(1);
    expect(quote.direction).toBe("up");
    expect(quote.isMarketOpen).toBeNull();
  });

  it("throws when symbol search cannot resolve an asset", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        status: "ok",
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketQuote("Unknown Asset")).rejects.toThrow("Unsupported asset: Unknown Asset");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws when Twelve Data returns an application error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "error",
        message: "Bad symbol",
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketQuote("Bitcoin")).rejects.toThrow("Bad symbol");
  });

  it("throws when the Twelve Data API key is missing", async () => {
    delete process.env.TWELVE_DATA_API_KEY;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "TWELVE_DATA_API_KEY is not configured.",
    );
  });

  it("throws when a quote payload does not contain a valid price", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        percent_change: "1.10",
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "Twelve Data quote did not include a valid price.",
    );
  });

  it("throws when a quote payload does not contain a valid percentage change", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        close: "4493.20",
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "Twelve Data quote did not include a valid percentage change.",
    );
  });

  it("throws when a time-series payload has no valid closes", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [{ close: "n/a" }],
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketSeries("Gold", "1W")).rejects.toThrow(
      "Twelve Data time series did not include enough close values.",
    );
  });

  it("throws when a time-series payload has only one valid close", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: [{ close: "4490" }],
      }),
    }) as unknown as typeof fetch;

    await expect(getMarketSeries("Gold", "1W")).rejects.toThrow(
      "Twelve Data time series did not include enough close values.",
    );
  });

  it("retries a transient quote failure before succeeding", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          close: "4493.20",
          percent_change: "1.10",
          is_market_open: true,
        }),
      }) as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4493.2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after retrying a network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow("network down");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
