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
  const originalApiKey = process.env.FMP_API_KEY;

  function mockJsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  function mockTextResponse(body: string, ok = true, status = 200) {
    return {
      ok,
      status,
      text: async () => body,
    } as Response;
  }

  beforeEach(() => {
    process.env.FMP_API_KEY = "test-key";
    clearMarketCaches();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.FMP_API_KEY;
    } else {
      process.env.FMP_API_KEY = originalApiKey;
    }
  });

  it("resolves supported asset aliases", () => {
    expect(resolveSupportedAsset("Trading Gold")).toEqual(null);
    expect(resolveSupportedAsset("Gold")?.symbol).toBe("GCUSD");
    expect(resolveSupportedAsset("XAU")?.symbol).toBe("GCUSD");
    expect(resolveSupportedAsset("Silver")?.symbol).toBe("SIUSD");
    expect(resolveSupportedAsset("EUR/USD")?.asset).toBe("EUR/USD");
    expect(resolveSupportedAsset("EU")?.symbol).toBe("EURUSD");
    expect(resolveSupportedAsset("GU")?.symbol).toBe("GBPUSD");
    expect(resolveSupportedAsset("Nasdaq")?.symbol).toBe("^IXIC");
    expect(resolveSupportedAsset("NAS")?.symbol).toBe("^IXIC");
    expect(resolveSupportedAsset("Dow Jones")?.symbol).toBe("^DJI");
  });

  it("does not infer short aliases from incidental substrings", () => {
    expect(inferMarketAssetFromText("Should I buy this because the language sounds nascent?")).toBeNull();
    expect(inferMarketAssetFromText("This guessing game has nothing to do with cable.")).toBeNull();
    expect(inferMarketAssetFromText("I like the ethics here.")).toBeNull();
  });

  it("parses a quote response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse([
          {
            price: 4493.2,
            changePercentage: 1.1,
          },
        ]),
      ) as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.asset).toBe("GOLD");
    expect(quote.price).toBe(4493.2);
    expect(quote.direction).toBe("up");
  });

  it("resolves an unknown asset through symbol search before quoting", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(
        mockJsonResponse([
          {
            symbol: "TSLA",
            name: "Tesla, Inc.",
            exchange: "NASDAQ",
          },
        ]),
      )
      .mockResolvedValueOnce(
        mockJsonResponse([
          {
            price: 28.11,
            changePercentage: 0.95,
          },
        ]),
      ) as unknown as typeof fetch;

    const quote = await getMarketQuote("Tesla");

    expect(quote.symbol).toBe("TSLA");
    expect(quote.asset).toBe("TESLA, INC. (TSLA)");
    expect(quote.price).toBe(28.11);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("parses a time-series response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse([
          { date: "2024-01-03", price: 4490 },
          { date: "2024-01-02", price: 4480 },
          { date: "2024-01-01", price: 4470 },
        ]),
      ) as unknown as typeof fetch;

    const series = await getMarketSeries("Gold", "1W");

    expect(series.closeValues).toEqual([4470, 4480, 4490]);
    expect(series.support).toBe(4470);
    expect(series.resistance).toBe(4490);
  });

  it("sorts time-series closes by datetime when present", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse([
          { date: "2024-01-03", close: 4490 },
          { date: "2024-01-01", close: 4470 },
          { date: "2024-01-02", close: 4480 },
        ]),
      ) as unknown as typeof fetch;

    const series = await getMarketSeries("Gold", "1W");

    expect(series.closeValues).toEqual([4470, 4480, 4490]);
  });

  it("derives a quote from a time series", () => {
    const quote = deriveQuoteFromSeries({
      asset: "GOLD",
      symbol: "GCUSD",
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
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse([])) as unknown as typeof fetch;

    await expect(getMarketQuote("Unknown Asset")).rejects.toThrow("Unsupported asset: Unknown Asset");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws when FMP returns an application error", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse({ "Error Message": "Bad symbol" })) as unknown as typeof fetch;

    await expect(getMarketQuote("Bitcoin")).rejects.toThrow("Bad symbol");
  });

  it("throws when the FMP API key is missing", async () => {
    delete process.env.FMP_API_KEY;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "FMP_API_KEY is not configured.",
    );
  });

  it("throws when a quote payload does not contain a valid price", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse([{ changePercentage: 1.1 }])) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "FMP quote did not include a valid price.",
    );
  });

  it("throws when a quote payload does not contain a valid percentage change", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse([{ price: 4493.2 }])) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow(
      "FMP quote did not include a valid percentage change.",
    );
  });

  it("throws when a time-series payload has no valid closes", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse([{ price: "n/a" }])) as unknown as typeof fetch;

    await expect(getMarketSeries("Gold", "1W")).rejects.toThrow(
      "FMP historical prices did not include enough close values.",
    );
  });

  it("throws when a time-series payload has only one valid close", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockJsonResponse([{ price: 4490 }])) as unknown as typeof fetch;

    await expect(getMarketSeries("Gold", "1W")).rejects.toThrow(
      "FMP historical prices did not include enough close values.",
    );
  });

  it("retries a transient quote failure before succeeding", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "temporary failure",
      })
      .mockResolvedValueOnce(
        mockJsonResponse([
          {
            price: 4493.2,
            changePercentage: 1.1,
          },
        ]),
      ) as unknown as typeof fetch;

    const quote = await getMarketQuote("Gold");

    expect(quote.price).toBe(4493.2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after retrying a network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow("network down");
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws when FMP returns a non-json restriction message", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        mockTextResponse("Premium Query Parameter: restricted symbol"),
      ) as unknown as typeof fetch;

    await expect(getMarketQuote("Gold")).rejects.toThrow("Premium Query Parameter: restricted symbol");
  });
});
