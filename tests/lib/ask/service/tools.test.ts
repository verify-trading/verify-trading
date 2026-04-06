import { describe, expect, it, vi } from "vitest";

import { createAskTools } from "@/lib/ask/service/tools";

describe("createAskTools", () => {
  it("uses the live quote when margin price is missing", async () => {
    const tools = createAskTools({
      getMarketQuoteImpl: vi.fn().mockResolvedValue({
        asset: "EUR/USD",
        symbol: "EUR/USD",
        price: 1.15,
        changePercent: 0.1,
        direction: "up",
        isMarketOpen: true,
      }),
    });

    const result = await tools.calculate_margin_required.execute?.(
      {
        pair: "EUR/USD",
        lotSize: 1,
        contractSize: 100_000,
        leverage: 30,
        accountCurrency: "USD",
      },
      {} as never,
    );

    expect(result).toEqual({
      card: {
        type: "insight",
        headline: "Margin Needed",
        body: "1 lot on EUR/USD needs USD 3833.33 margin.",
        verdict: "Check free margin before you open the trade.",
      },
    });
  });

  it("uses the live pair price when position sizing needs a base-currency conversion", async () => {
    const getMarketQuoteImpl = vi.fn().mockResolvedValue({
      asset: "GBP/USD",
      symbol: "GBP/USD",
      price: 1.294,
      changePercent: 0.1,
      direction: "up",
      isMarketOpen: true,
    });
    const tools = createAskTools({ getMarketQuoteImpl });

    const result = await tools.calculate_position_size.execute?.(
      {
        accountSize: 7500,
        riskPercent: 0.75,
        stopLossPips: 28,
        pair: "GBP/USD",
        accountCurrency: "GBP",
      },
      {} as never,
    );

    expect(getMarketQuoteImpl).toHaveBeenCalledWith("GBP/USD");
    expect(result).toEqual({
      card: {
        type: "calc",
        lots: "0.26",
        risk_amount: "£56.25",
        account: "£7,500.00",
        risk_pct: "0.75%",
        sl_pips: "28",
        verdict: "Size down first. Protect the downside before chasing the upside.",
      },
    });
  });

  it("returns a clean coverage card when entity verification has no match", async () => {
    const tools = createAskTools({
      lookupVerifiedEntityImpl: vi.fn().mockResolvedValue({
        found: false,
      }),
    });

    const result = await tools.verify_entity.execute?.(
      {
        name: "Unknown Alpha Broker",
      },
      {} as never,
    );

    expect(result).toEqual({
      card: {
        type: "insight",
        headline: "Limited Coverage",
        body: "I do not have a reviewed record for that name yet.",
        verdict: "Send the exact broker, firm, or brand name.",
      },
    });
  });

  it("keeps prop firms out of the broker FCA path", async () => {
    const getFcaStatusImpl = vi.fn();
    const tools = createAskTools({
      getFcaStatusImpl,
      lookupVerifiedEntityImpl: vi.fn().mockResolvedValue({
        found: true,
        entity: {
          id: "ftmo",
          name: "FTMO",
          type: "propfirm",
          status: "legitimate",
          fcaRegistered: false,
          fcaReference: null,
          fcaWarning: false,
          trustScore: 9.1,
          notes: "Most trusted prop firm globally. Consistent payouts. Strong community reputation.",
          source: "verify.trading research",
          aliases: ["ftmo"],
        },
        brokerCardHint: {
          name: "FTMO",
          score: "9.1",
          status: "LEGITIMATE",
          fca: "No",
          complaints: "Low",
          color: "green",
        },
      }),
    });

    const result = await tools.verify_entity.execute?.(
      {
        name: "FTMO",
      },
      {} as never,
    );

    expect(getFcaStatusImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      card: {
        type: "broker",
        name: "FTMO",
        score: "9.1",
        status: "LEGITIMATE",
        fca: "No",
        complaints: "Low",
        verdict:
          "Most trusted prop firm globally. Consistent payouts. Strong community reputation. Not FCA-regulated because it is a prop firm, not a retail broker.",
        color: "green",
      },
      uiMeta: {
        verificationKind: "propfirm",
        verificationSourceLabel: "Reviewed record",
      },
    });
  });

  it("keeps briefing support and resistance aligned around the current price", async () => {
    const tools = createAskTools({
      getMarketQuoteImpl: vi.fn().mockResolvedValue({
        asset: "GOLD / XAUUSD",
        symbol: "XAU/USD",
        price: 4658.75,
        changePercent: -0.38,
        direction: "down",
        isMarketOpen: true,
      }),
      getMarketSeriesImpl: vi.fn().mockResolvedValue({
        asset: "GOLD / XAUUSD",
        symbol: "XAU/USD",
        timeframe: "1W",
        closeValues: [4676.39, 4676.53, 4682.14],
        resistance: 4682.14,
        support: 4676.39,
      }),
    });

    const result = await tools.get_market_briefing.execute?.(
      {
        asset: "Gold",
        timeframe: "1W",
      },
      {} as never,
    );

    expect(result).toEqual({
      card: {
        type: "briefing",
        asset: "GOLD / XAUUSD",
        price: "4658.75",
        change: "-0.38%",
        direction: "down",
        level1: "4676.39",
        level2: "4658.75",
        event: null,
        verdict: "GOLD / XAUUSD is leaning heavy. Watch support for the next move.",
      },
      uiMeta: {
        marketSeries: [4676.39, 4676.53, 4682.14],
        marketLevelScopeLabel: "Near-term levels",
      },
    });
  });

  it("uses the full visible range when price sits on the edge of the recent closes", async () => {
    const tools = createAskTools({
      getMarketQuoteImpl: vi.fn().mockResolvedValue({
        asset: "GOLD / XAUUSD",
        symbol: "XAU/USD",
        price: 4700.5,
        changePercent: 0.51,
        direction: "up",
        isMarketOpen: true,
      }),
      getMarketSeriesImpl: vi.fn().mockResolvedValue({
        asset: "GOLD / XAUUSD",
        symbol: "XAU/USD",
        timeframe: "1W",
        closeValues: [4689.2, 4694.85, 4700.5],
        resistance: 4700.5,
        support: 4689.2,
      }),
    });

    const result = await tools.get_market_briefing.execute?.(
      {
        asset: "Gold",
        timeframe: "1W",
      },
      {} as never,
    );

    expect(result).toEqual({
      card: {
        type: "briefing",
        asset: "GOLD / XAUUSD",
        price: "4700.50",
        change: "+0.51%",
        direction: "up",
        level1: "4700.50",
        level2: "4694.85",
        event: null,
        verdict: "GOLD / XAUUSD is holding above support. Watch resistance for continuation.",
      },
      uiMeta: {
        marketSeries: [4689.2, 4694.85, 4700.5],
        marketLevelScopeLabel: "Near-term levels",
      },
    });
  });

  it("uses a neutral compressed verdict when the live range is too tight", async () => {
    const tools = createAskTools({
      getMarketQuoteImpl: vi.fn().mockResolvedValue({
        asset: "EUR/USD",
        symbol: "EUR/USD",
        price: 1.1,
        changePercent: 0.04,
        direction: "up",
        isMarketOpen: true,
      }),
      getMarketSeriesImpl: vi.fn().mockResolvedValue({
        asset: "EUR/USD",
        symbol: "EUR/USD",
        timeframe: "1W",
        closeValues: [1.0995, 1.1005, 1.1002],
        resistance: 1.1005,
        support: 1.0995,
      }),
    });

    const result = await tools.get_market_briefing.execute?.(
      {
        asset: "EUR/USD",
        timeframe: "1W",
      },
      {} as never,
    );

    expect(result).toEqual({
      card: {
        type: "briefing",
        asset: "EUR/USD",
        price: "1.10",
        change: "+0.04%",
        direction: "up",
        level1: "1.10",
        level2: "1.10",
        event: null,
        verdict: "EUR/USD is compressed here. Wait for a clean break before choosing a side.",
      },
      uiMeta: {
        marketSeries: [1.0995, 1.1005, 1.1002],
        marketLevelScopeLabel: "Near-term levels",
      },
    });
  });

  it("search_news delegates to fetchNewsEverythingImpl", async () => {
    const fetchNewsEverythingImpl = vi.fn().mockResolvedValue({
      query: "iran oil",
      articles: [
        {
          title: "T",
          source: "S",
          url: "https://example.com",
          publishedAt: "2026-04-01T00:00:00Z",
        },
      ],
    });
    const tools = createAskTools({ fetchNewsEverythingImpl });

    const result = await tools.search_news.execute?.({ query: "iran oil" }, {} as never);

    expect(fetchNewsEverythingImpl).toHaveBeenCalledWith(
      expect.objectContaining({ query: "iran oil" }),
    );
    expect(result).toEqual({
      query: "iran oil",
      articles: [
        {
          title: "T",
          source: "S",
          description: undefined,
        },
      ],
      note: undefined,
    });
  });

  it("submit_ask_card parses card_json and returns validated card", async () => {
    const tools = createAskTools({});
    const card = {
      type: "insight" as const,
      headline: "Iran Oil Themes",
      body: "Themes here.",
      verdict: "Angle one with source.",
    };

    const result = await tools.submit_ask_card.execute?.(
      { card_json: JSON.stringify(card) },
      {} as never,
    );

    expect(result).toEqual({ card });
  });
});
