import { RetryError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { fallbackInsightCard } from "@/lib/ask/contracts";
import { logger } from "@/lib/observability/logger";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { generateAskResponse } from "@/lib/ask/service";

describe("generateAskResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a parsed card when the model emits valid JSON", async () => {
    const response = await generateAskResponse(
      {
        message: "Why do I keep revenge trading?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "insight",
            headline: "Revenge Trading",
            body: "Losses hijack discipline fast. Step away before the next click.",
            verdict: "Stop after two bad trades.",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("insight");
    expect(response.data).not.toEqual(fallbackInsightCard);
  });

  it("extracts valid JSON when the model wraps it in extra text", async () => {
    const response = await generateAskResponse(
      {
        message: "Why do I keep revenge trading?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: `Answer: ${JSON.stringify({
            type: "insight",
            headline: "Reset Bias",
            body: "Your discipline slips when losses speed you up.",
            verdict: "Pause after the first emotional trade.",
          })}`,
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("insight");
    if (response.data.type !== "insight") {
      throw new Error("Expected an insight card.");
    }
    expect(response.data.headline).toBe("Reset Bias");
  });

  it("asks for account context instead of forcing an ambiguous cash-risk lot size calc", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "lot size 250 quid risk 17 stop",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data).toEqual({
      type: "insight",
      headline: "Need Account Size",
      body: "That reads like direct money risk plus a stop loss, not account size plus risk percent. I need the account size or risk percent to size it properly.",
      verdict: "Send the account size or risk percent.",
    });
  });

  it("returns a friendly acknowledgement insight for thanks without calling the model", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "thanks",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data).toEqual({
      type: "insight",
      headline: "You're welcome",
      body: "Glad that helped. If anything else comes up on markets, brokers, risk, or setups, just ask.",
      verdict: "Send your next trading question when you are ready.",
    });
  });

  it("short-circuits direct market-status asks into a briefing card without calling the model", async () => {
    const generateTextImpl = vi.fn();
    const getMarketQuoteImpl = vi.fn().mockResolvedValue({
      asset: "GOLD",
      symbol: "GCUSD",
      price: 4736.3,
      changePercent: -0.86,
      direction: "down",
      isMarketOpen: null,
    });
    const getMarketSeriesImpl = vi.fn().mockResolvedValue({
      asset: "GOLD",
      symbol: "GCUSD",
      timeframe: "1W",
      closeValues: [4699.3, 4721.5, 4745.1, 4736.3],
      resistance: 4745.1,
      support: 4699.3,
    });

    const response = await generateAskResponse(
      {
        message: "status on gold?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
        getMarketQuoteImpl,
        getMarketSeriesImpl,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(getMarketQuoteImpl).toHaveBeenCalledWith("GOLD");
    expect(getMarketSeriesImpl).toHaveBeenCalledWith("GOLD", "1W");
    expect(response.data.type).toBe("briefing");
    expect(response.uiMeta).toEqual({
      marketSeries: [4699.3, 4721.5, 4745.1, 4736.3],
      marketLevelScopeLabel: "Near-term levels",
    });
  });

  it("short-circuits direct broker safety checks without calling the model", async () => {
    const generateTextImpl = vi.fn();
    const lookupVerifiedEntityImpl = vi.fn().mockResolvedValue({
      found: true,
      entity: {
        id: "pepperstone",
        name: "Pepperstone",
        type: "broker",
        status: "legitimate",
        fcaRegistered: true,
        fcaReference: "684312",
        fcaWarning: false,
        trustScore: 8.9,
        notes: "FCA authorised. Strong execution and low spreads.",
        source: "seed",
        aliases: ["pepperstone"],
      },
      brokerCardHint: {
        name: "Pepperstone",
        score: "8.9",
        status: "LEGITIMATE",
        fca: "Yes",
        complaints: "Low",
        color: "green",
      },
    });
    const getFcaStatusImpl = vi.fn().mockResolvedValue({
      available: true,
      queriedName: "Pepperstone",
      frn: "684312",
      authorised: true,
      warning: false,
      statusText: "Authorised",
      source: "FCA live lookup",
      note: "FCA authorised. Strong execution and low spreads.",
    });

    const response = await generateAskResponse(
      {
        message: "Is Pepperstone safe for UK retail clients?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
        lookupVerifiedEntityImpl,
        getFcaStatusImpl,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data).toEqual({
      type: "broker",
      name: "Pepperstone",
      score: "8.9",
      status: "LEGITIMATE",
      fca: "Yes",
      complaints: "Low",
      verdict: "FCA authorised. Strong execution and low spreads.",
      color: "green",
    });
    expect(response.uiMeta).toEqual({
      verificationKind: "broker",
      verificationSourceLabel: "Live FCA confirmed",
    });
  });

  it("short-circuits direct pip value asks without calling the model", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "EUR/USD 1 lot pip value?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data).toEqual({
      type: "insight",
      headline: "Pip Value",
      body: "1 lot on EUR/USD moves USD 10.00 per pip.",
      verdict: "Use that number before sizing the trade.",
    });
  });

  it("short-circuits direct risk-reward asks without calling the model", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "If I buy EUR/USD at 1.1000, stop 1.0950, target 1.1100 what's the RR?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data).toEqual({
      type: "insight",
      headline: "Risk Reward",
      body: "Risk is 0.005. Reward is 0.01. Ratio is 2.00 to 1.",
      verdict: "Take it only if the reward still justifies the setup.",
    });
  });

  it("does not short-circuit multi-asset market questions", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Compare Strength",
        body: "Gold and Bitcoin need comparison context, not a single-market shortcut.",
        verdict: "Use the broader reasoning path here.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;
    const getMarketQuoteImpl = vi.fn();
    const getMarketSeriesImpl = vi.fn();

    await generateAskResponse(
      {
        message: "status on gold and bitcoin?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl,
        getMarketQuoteImpl,
        getMarketSeriesImpl,
      },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(getMarketQuoteImpl).not.toHaveBeenCalled();
    expect(getMarketSeriesImpl).not.toHaveBeenCalled();
  });

  it("does not short-circuit macro or news-framed market questions", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Macro Matters",
        body: "Gold after CPI needs context beyond a raw market-status shortcut.",
        verdict: "Use the normal model path.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;
    const getMarketQuoteImpl = vi.fn();
    const getMarketSeriesImpl = vi.fn();

    await generateAskResponse(
      {
        message: "status on gold after CPI?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl,
        getMarketQuoteImpl,
        getMarketSeriesImpl,
      },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(getMarketQuoteImpl).not.toHaveBeenCalled();
    expect(getMarketSeriesImpl).not.toHaveBeenCalled();
  });

  it("keeps market-plus-news queries on the full model path", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Gold After CPI",
        body: "This needs both the market move and the macro catalyst, so it should stay on the full reasoning path.",
        verdict: "Use news plus price context together.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;
    const getMarketQuoteImpl = vi.fn();
    const getMarketSeriesImpl = vi.fn();

    await generateAskResponse(
      {
        message: "What is gold doing after CPI today?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl,
        getMarketQuoteImpl,
        getMarketSeriesImpl,
      },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(getMarketQuoteImpl).not.toHaveBeenCalled();
    expect(getMarketSeriesImpl).not.toHaveBeenCalled();
  });

  it("does not treat thanks with extra trading content as a pure acknowledgement", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Gold",
        body: "Follow-up noted.",
        verdict: "Ask for levels if you want a plan.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "thanks — what about gold now?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("insight");
    if (response.data.type !== "insight") {
      throw new Error("Expected an insight card.");
    }
    expect(response.data.headline).toBe("Gold");
  });

  it("short-circuits clear projection prompts into a projection card", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "24-month projection: £10k start, £400/month",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data.type).toBe("projection");
    if (response.data.type !== "projection") {
      throw new Error("Expected a projection card.");
    }
    expect(response.data.months).toBe(24);
    expect(response.data.startBalance).toBe(10000);
    expect(response.data.monthlyAdd).toBe(400);
    expect(response.uiMeta?.projectionMarkers).toBeDefined();
  });

  it("preserves the detected currency symbol on projection shortcuts", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "12-month projection: $500 start, $100/month",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data.type).toBe("projection");
    if (response.data.type !== "projection") {
      throw new Error("Expected a projection card.");
    }
    expect(response.data.currencySymbol).toBe("$");
    expect(response.data.startBalance).toBe(500);
    expect(response.data.monthlyAdd).toBe(100);
  });

  it("preserves explicit projection assumptions in shortcut verdicts", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message:
          "8 month projection £10k start £500 monthly top up at 5% monthly return with 10% drawdowns every 4 months",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data.type).toBe("projection");
    if (response.data.type !== "projection") {
      throw new Error("Expected a projection card.");
    }
    expect(response.data.verdict.startsWith("Using 5% monthly returns with 10% drawdowns every 4 months.")).toBe(
      true,
    );
  });

  it("short-circuits balance target prompts into a plan card", async () => {
    const generateTextImpl = vi.fn();

    const response = await generateAskResponse(
      {
        message: "I have deposited $500 give me a plan of what target to make daily weekly and month and projection",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: generateTextImpl as unknown as typeof import("ai").generateText,
      },
    );

    expect(generateTextImpl).not.toHaveBeenCalled();
    expect(response.data.type).toBe("plan");
    if (response.data.type !== "plan") {
      throw new Error("Expected a plan card.");
    }
    expect(response.data.currencySymbol).toBe("$");
    expect(response.data.startBalance).toBe(500);
    expect(response.data.dailyTarget).toContain("$");
    expect(response.data.monthlyTarget).toContain("$");
    expect(response.data.projectedBalance).toBeGreaterThan(500);
  });

  it("lets claude handle explicit market entry prompts", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "setup",
        asset: "GOLD / XAUUSD",
        bias: "Bullish",
        entry: "4649.77",
        stop: "4640.00",
        target: "4669.31",
        rr: "2:1",
        rationale: "Gold needs a reclaim first, so the cleaner long is confirmation above resistance.",
        confidence: "Low",
        verdict: "Buy only after price reclaims 4649.77 and holds.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What price should I buy gold at?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("setup");
    if (response.data.type !== "setup") {
      throw new Error("Expected a setup card.");
    }
    expect(response.data.asset).toBe("GOLD / XAUUSD");
    expect(response.data.bias).toBe("Bullish");
    expect(response.data.entry).toBe("4649.77");
  });

  it("lets claude handle conversational setup requests", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "setup",
        asset: "GOLD / XAUUSD",
        bias: "Bullish",
        entry: "4648.50-4649.20",
        stop: "4640.00",
        target: "4668.00",
        rr: "2:1",
        rationale: "The long only makes sense on a controlled pullback or clean reclaim, not a chase.",
        confidence: "Low",
        verdict: "Wait for price to come back to you instead of buying the middle.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Set up a buy trade on gold",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("setup");
    if (response.data.type !== "setup") {
      throw new Error("Expected a setup card.");
    }
    expect(response.data.asset).toBe("GOLD / XAUUSD");
    expect(response.data.bias).toBe("Bullish");
  });

  it("lets the model ask for direction when a setup request names a market but not a side", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Need Direction",
        body: "I can set up GOLD / XAUUSD, but I need direction first.",
        verdict: "Send buy or sell, or long or short.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Set up a trade on gold",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("insight");
  });

  it("lets the model ask for market when a setup request names direction but not asset", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Need Market",
        body: "I can build a sell setup, but I need the market first.",
        verdict: "Send the asset or symbol, like Gold, BTC, EUR/USD, or Nasdaq.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Set up a short trade for me",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("insight");
  });

  it("lets generic setup education flow to the model as insight", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Trade Setup",
        body: "Pick the market, define invalidation, size the risk, then map entry and target before you click.",
        verdict: "If you want a live setup, send the asset and direction.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Tell me how to set up a trade",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("insight");
  });

  it("lets broader trade-idea questions stay model-led", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "setup",
        asset: "GOLD / XAUUSD",
        bias: "Bearish",
        entry: "4642.44-4644.10",
        stop: "4648.27",
        target: "4630.79",
        rr: "2:1",
        rationale: "Gold is the cleanest setup right now after comparing a few liquid markets.",
        confidence: "Medium",
        verdict: "Sell the rally only if resistance keeps capping price.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What will bee the best trade to get into now",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("setup");
  });

  it("lets broader market-bias questions stay model-led", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Gold Bias",
        body: "Gold still looks heavy here, but I would rather frame that as a market view than force a live entry.",
        verdict: "Ask for a buy or sell setup if you want exact levels.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Is gold bearish here?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("insight");
  });

  it("lets the model compare a new asset against the active setup context", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "insight",
        headline: "Gold Over Oil",
        body: "Oil can move harder, but it is more event-driven right now. Gold is cleaner when I want a tighter invalidation and steadier structure.",
        verdict: "If you want a fresh oil entry, ask me for an oil setup.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Why not oil",
        sessionId: crypto.randomUUID(),
        history: [
          { role: "user", content: "What will be the best trade to get into now?" },
          {
            role: "assistant",
            content: JSON.stringify({
              type: "setup",
              asset: "GOLD / XAUUSD",
              bias: "Bearish",
              entry: "4642.44-4644.10",
              stop: "4648.27",
              target: "4630.79",
              rr: "2:1",
              rationale: "Gold is the cleanest setup right now.",
              confidence: "Medium",
              verdict: "Sell the rally into 4642-4644.",
            }),
          },
        ],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    expect(call?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Active asset: GOLD / XAUUSD"),
        }),
      ]),
    );
    expect(response.data.type).toBe("insight");
  });

  it("falls back to a tool-generated card when the final text is unusable", async () => {
    const response = await generateAskResponse(
      {
        message: "Lot size 1% risk £10k 20 pip stop",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "not json",
          toolResults: [
            {
              output: {
                card: {
                  type: "calc",
                  lots: "0.50",
                  risk_amount: "£100.00",
                  account: "£10,000.00",
                  risk_pct: "1%",
                  sl_pips: "20",
                  verdict: "Size down first. Protect the downside before chasing the upside.",
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("calc");
    if (response.data.type !== "calc") {
      throw new Error("Expected a calc card.");
    }
    expect(response.data.lots).toBe("0.50");
  });

  it("uses submit_ask_card even when search_news was not used", async () => {
    const response = await generateAskResponse(
      {
        message: "What should I focus on first?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "",
          toolResults: [
            {
              toolName: "verify_entity",
              output: {
                card: {
                  type: "broker",
                  name: "Pepperstone",
                  score: "8.9",
                  status: "LEGITIMATE",
                  fca: "Yes",
                  complaints: "Low",
                  verdict: "Broker check.",
                  color: "green",
                },
              },
            },
            {
              toolName: "submit_ask_card",
              output: {
                card: {
                  type: "insight",
                  headline: "Start With Risk",
                  body: "Your first priority is risk control, not broker comparison or market bias.",
                  verdict: "Lock position sizing first.",
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual({
      type: "insight",
      headline: "Start With Risk",
      body: "Your first priority is risk control, not broker comparison or market bias.",
      verdict: "Lock position sizing first.",
    });
  });

  it("configures the loop to stop after a successful submit_ask_card result", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: "",
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    await generateAskResponse(
      {
        message: "What should I focus on first?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    const stopWhen = vi.mocked(generateTextImpl).mock.calls[0]?.[0]?.stopWhen;
    expect(Array.isArray(stopWhen)).toBe(true);
    const submitStopCondition = Array.isArray(stopWhen) ? stopWhen[1] : null;
    expect(submitStopCondition).toBeTypeOf("function");
    expect(
      submitStopCondition?.({
        steps: [
          {
            toolResults: [{ toolName: "submit_ask_card" }],
          },
        ],
      }),
    ).toBe(true);
    expect(
      submitStopCondition?.({
        steps: [
          {
            toolResults: [{ toolName: "get_market_briefing" }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("prefers the model's final JSON card over a raw tool card", async () => {
    const response = await generateAskResponse(
      {
        message: "Why not oil?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "insight",
            headline: "Gold Over Oil",
            body: "Oil can move harder, but gold is cleaner when structure matters more than volatility.",
            verdict: "Ask for fresh oil levels if you want that setup instead.",
          }),
          toolResults: [
            {
              toolName: "get_market_briefing",
              output: {
                card: {
                  type: "briefing",
                  asset: "WTI / USOIL",
                  price: "100.00",
                  change: "+1.00%",
                  direction: "up",
                  level1: "101.00",
                  level2: "99.00",
                  event: null,
                  verdict: "WTI is firm.",
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("insight");
    expect(response.data.type === "insight" ? response.data.headline : null).toBe("Gold Over Oil");
  });

  it("wraps plain text model output into an insight card", async () => {
    const response = await generateAskResponse(
      {
        message: "Explain what is going wrong here",
        sessionId: crypto.randomUUID(),
        history: [{ role: "user", content: "Earlier context" }],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "I need one key input before I can run this. What monthly return percentage are you targeting?",
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("insight");
    expect(response.data).not.toEqual(fallbackInsightCard);
    if (response.data.type !== "insight") {
      throw new Error("Expected an insight card.");
    }
    expect(response.data.headline).toBe("Need Input");
    expect(response.data.body).toContain("I need one key input");
  });

  it("adds market series ui metadata when a briefing tool response includes close values", async () => {
    const response = await generateAskResponse(
      {
        message: "What is Gold doing today?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "briefing",
            asset: "Gold / XAUUSD",
            price: "$4,493",
            change: "+0.8%",
            direction: "up",
            level1: "4,505",
            level2: "4,470",
            event: null,
            verdict: "Gold is holding firm above intraday support.",
          }),
          toolResults: [
            {
              output: {
                card: {
                  type: "briefing",
                  asset: "Gold / XAUUSD",
                  price: "$4,493",
                  change: "+0.8%",
                  direction: "up",
                  level1: "4,505",
                  level2: "4,470",
                  event: null,
                  verdict: "Gold is holding firm above intraday support.",
                },
                uiMeta: {
                  marketSeries: [4470, 4482, 4493],
                  marketLevelScopeLabel: "Near-term levels",
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("briefing");
    expect(response.uiMeta).toEqual({
      marketSeries: [4470, 4482, 4493],
      marketLevelScopeLabel: "Near-term levels",
    });
  });

  it("does not surface briefing ui metadata on final non-briefing cards", async () => {
    const response = await generateAskResponse(
      {
        message:
          "I’m a UK retail trader with a £12,500 account. I’m considering Pepperstone for forex, I want to risk 0.8% on GBP/USD, and I’m watching Gold and Nasdaq for bias this week. Give me the most important thing I should focus on first and why.",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "insight",
            headline: "Define Risk First",
            body: "Pepperstone looks fine and market bias can wait. Your first job is defining the GBP/USD stop in pips because that is what makes the 0.8% risk real.",
            verdict: "Send the stop in pips and I’ll size the trade.",
          }),
          toolResults: [
            {
              output: {
                card: {
                  type: "briefing",
                  asset: "NASDAQ",
                  price: "558.00",
                  change: "+0.4%",
                  direction: "up",
                  level1: "562.00",
                  level2: "550.00",
                  event: null,
                  verdict: "Nasdaq proxy is firm above support.",
                },
                uiMeta: {
                  marketSeries: [550, 554, 558],
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("insight");
    expect(response.uiMeta?.marketSeries).toBeUndefined();
  });

  it("surfaces verification metadata on broker cards from tool results", async () => {
    const response = await generateAskResponse(
      {
        message: "Is Pepperstone FCA regulated?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "broker",
            name: "Pepperstone",
            score: "8.9",
            status: "LEGITIMATE",
            fca: "Yes",
            complaints: "Low",
            verdict: "FCA authorised. Strong execution and low spreads.",
            color: "green",
          }),
          toolResults: [
            {
              output: {
                card: {
                  type: "broker",
                  name: "Pepperstone",
                  score: "8.9",
                  status: "LEGITIMATE",
                  fca: "Yes",
                  complaints: "Low",
                  verdict: "FCA authorised. Strong execution and low spreads.",
                  color: "green",
                },
                uiMeta: {
                  verificationKind: "broker",
                  verificationSourceLabel: "Live FCA confirmed",
                },
              },
            },
          ],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("broker");
    expect(response.uiMeta).toEqual({
      verificationKind: "broker",
      verificationSourceLabel: "Live FCA confirmed",
    });
  });

  it("accepts briefing cards when the model returns numeric display fields", async () => {
    const response = await generateAskResponse(
      {
        message: "What is Gold doing today?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "briefing",
            asset: "Gold (XAU/USD)",
            price: 4676.51,
            change: "+0.02%",
            direction: "up",
            level1: 4678,
            level2: 4662.4,
            event: null,
            verdict: "Gold is firm above support.",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("briefing");
    if (response.data.type !== "briefing") {
      throw new Error("Expected a briefing card.");
    }
    expect(response.data.price).toBe("4676.51");
    expect(response.data.level1).toBe("4678");
    expect(response.data.level2).toBe("4662.4");
  });

  it("ignores extra top-level keys outside the card schema", async () => {
    const response = await generateAskResponse(
      {
        message: "Lot size 1% risk £10000",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "calc",
            lots: "0.20",
            risk_amount: "£100.00",
            account: "£10,000.00",
            risk_pct: "1%",
            sl_pips: "50",
            verdict: "This is only a rough size.",
            commentary: "A tighter stop would increase size, a wider stop would reduce it.",
            assumption: "Used a 50 pip stop for a rough estimate.",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("calc");
    expect(response.uiMeta).toBeUndefined();
  });

  it("adds projection markers ui metadata for projection cards", async () => {
    const response = await generateAskResponse(
      {
        message: "Project this account for 12 months",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "projection",
            months: 6,
            startBalance: 10000,
            monthlyAdd: 500,
            projectedBalance: 14500,
            dataPoints: [10000, 10400, 10850, 11600, 12900, 14500],
            totalReturn: "45%",
            lossEvents: 2,
            verdict: "The curve is healthy if you protect drawdown.",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data.type).toBe("projection");
    expect(response.uiMeta?.projectionMarkers).toEqual([1, 3]);
  });

  it("falls back to an accumulated projection tool card when the final model text is invalid", async () => {
    const generateTextImpl = vi.fn().mockImplementation(async (options: { onStepFinish?: (step: unknown) => void }) => {
      options.onStepFinish?.({
        stepNumber: 0,
        text: "",
        toolCalls: [{ toolName: "generate_projection", input: { months: 18 } }],
        toolResults: [
          {
            toolName: "generate_projection",
            output: {
              card: {
                type: "projection",
                months: 18,
                startBalance: 10000,
                monthlyAdd: 500,
                projectedBalance: 32308.18,
                dataPoints: [10920, 11876.8, 12871.87],
                totalReturn: "47.8%",
                lossEvents: 0,
                verdict: "Smooth growth is a fantasy. Expect pullbacks and size the plan around them.",
              },
            },
          },
        ],
        finishReason: "tool-calls",
        usage: undefined,
      });

      return {
        text: JSON.stringify({
          type: "projection",
          startBalance: "£10,000",
        }),
        toolResults: [],
      };
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "18 month projection £10000 start £500 monthly top up",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl,
      },
    );

    expect(response.data.type).toBe("projection");
  });

  it("recovers a broker card from a verification tool card when the model JSON is invalid", async () => {
    const generateTextImpl = vi.fn().mockImplementation(async (options: { onStepFinish?: (step: unknown) => void }) => {
      options.onStepFinish?.({
        stepNumber: 0,
        text: "",
        toolCalls: [{ toolName: "verify_entity", input: { name: "Pepperstone" } }],
        toolResults: [
          {
            toolName: "verify_entity",
            output: {
              card: {
                type: "broker",
                name: "Pepperstone",
                score: "8.9",
                status: "LEGITIMATE",
                fca: "Yes",
                complaints: "Low",
                verdict: "FCA authorised. Strong execution and low spreads.",
                color: "green",
              },
            },
          },
        ],
        finishReason: "tool-calls",
        usage: undefined,
      });

      return {
        text: JSON.stringify({
          type: "broker",
          name: "Pepperstone",
          frn: "684312",
          trustScore: "8.9/10",
        }),
        toolResults: [],
      };
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Is Pepperstone FCA regulated?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data.type).toBe("broker");
    if (response.data.type !== "broker") {
      throw new Error("Expected a broker card.");
    }
    expect(response.data.name).toBe("Pepperstone");
    expect(response.data.fca).toBe("Yes");
  });

  it("recovers an insight card from a calculator tool card when the model returns the wrong schema", async () => {
    const generateTextImpl = vi.fn().mockImplementation(async (options: { onStepFinish?: (step: unknown) => void }) => {
      options.onStepFinish?.({
        stepNumber: 0,
        text: "",
        toolCalls: [{ toolName: "calculate_margin_required", input: { pair: "EUR/USD" } }],
        toolResults: [
          {
            toolName: "calculate_margin_required",
            output: {
              card: {
                type: "insight",
                headline: "Margin Needed",
                body: "1 lot on EUR/USD needs USD 3838.63 margin.",
                verdict: "Check free margin before you open the trade.",
              },
            },
          },
        ],
        finishReason: "tool-calls",
        usage: undefined,
      });

      return {
        text: JSON.stringify({
          type: "calc",
          headline: "Margin Required",
        }),
        toolResults: [],
      };
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What margin do I need for 1 lot EUR/USD at 30:1 leverage?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data.type).toBe("insight");
    if (response.data.type !== "insight") {
      throw new Error("Expected an insight card.");
    }
    expect(response.data.headline).toBe("Margin Needed");
  });

  it("wraps plain text output when the response cannot be parsed", async () => {
    const response = await generateAskResponse(
      {
        message: "Tell me something broken",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "still not json",
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual({
      type: "insight",
      headline: "Quick Take",
      body: "still not json",
      verdict: "Ask a sharper follow-up if you want me to refine it.",
    });
  });

  it("wraps plain text output even when tool output is invalid", async () => {
    const response = await generateAskResponse(
      {
        message: "Tell me something broken",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "still not json",
          toolResults: [{ output: { invalid: true } }],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual({
      type: "insight",
      headline: "Quick Take",
      body: "still not json",
      verdict: "Ask a sharper follow-up if you want me to refine it.",
    });
  });

  it("falls back cleanly when the model emits invalid card JSON", async () => {
    const response = await generateAskResponse(
      {
        message: "Tell me something malformed",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "insight",
            headline: "",
            body: "",
            verdict: "",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual(fallbackInsightCard);
  });

  it("still returns the fallback card when there is no usable text or tool card", async () => {
    const response = await generateAskResponse(
      {
        message: "Tell me something broken",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: "   ",
          toolResults: [{ output: { invalid: true } }],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual(fallbackInsightCard);
  });

  it("passes history through to the model call", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify(fallbackInsightCard),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    await generateAskResponse(
      {
        message: "What about EUR/USD?",
        sessionId: crypto.randomUUID(),
        history: [
          { role: "user", content: "What is Gold doing?" },
          { role: "assistant", content: JSON.stringify(fallbackInsightCard) },
        ],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalled();
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    expect(call?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "What is Gold doing?" }),
      ]),
    );
    expect(call?.maxRetries).toBe(2);
  });

  it("injects derived session state into the model call", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify(fallbackInsightCard),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    await generateAskResponse(
      {
        message: "What do you think now?",
        sessionId: crypto.randomUUID(),
        history: [
          { role: "user", content: "What price should I buy gold at?" },
          {
            role: "assistant",
            content: JSON.stringify({
              type: "setup",
              asset: "GOLD / XAUUSD",
              bias: "Bullish",
              entry: "4649.77",
              stop: "4640.00",
              target: "4669.31",
              rr: "2:1",
              rationale: "Wait for reclaim.",
              confidence: "Low",
              verdict: "Buy only after confirmation.",
            }),
          },
        ],
      },
      { generateTextImpl },
    );

    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    expect(call?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Active asset: GOLD / XAUUSD"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Active trade side: buy"),
        }),
      ]),
    );
  });

  it("uses session state for setup follow-ups without shortcutting the model", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "setup",
        asset: "GOLD / XAUUSD",
        bias: "Bullish",
        entry: "4649.77",
        stop: "4643.00",
        target: "4669.31",
        rr: "2:1",
        rationale: "A tighter stop is fine only if price confirms and you accept the higher chance of getting clipped.",
        confidence: "Low",
        verdict: "Tighten the stop only after confirmation, not before.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What about a tighter stop?",
        sessionId: crypto.randomUUID(),
        history: [
          { role: "user", content: "What price should I buy gold at?" },
          {
            role: "assistant",
            content: JSON.stringify({
              type: "setup",
              asset: "GOLD / XAUUSD",
              bias: "Bullish",
              entry: "4649.77",
              stop: "4640.00",
              target: "4669.31",
              rr: "2:1",
              rationale: "Wait for reclaim.",
              confidence: "Low",
              verdict: "Buy only after confirmation.",
            }),
          },
        ],
      },
      { generateTextImpl },
    );

    expect(generateTextImpl).toHaveBeenCalledOnce();
    expect(response.data.type).toBe("setup");
    if (response.data.type !== "setup") {
      throw new Error("Expected a setup card.");
    }
    expect(response.data.asset).toBe("GOLD / XAUUSD");
    expect(response.data.bias).toBe("Bullish");
  });

  it("injects analysis rules into image requests before the user chart message", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "chart",
        pattern: "Range",
        bias: "Bullish",
        entry: "100",
        stop: "95",
        target: "110",
        rr: "2:1",
        confidence: "Medium",
        verdict: "Wait for confirmation.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;
    const getActiveAnalysisRulesImpl = vi.fn().mockResolvedValue([
      {
        ruleNumber: 1,
        category: "FOUNDATION",
        ruleName: "Support and Resistance",
        content: "Higher timeframe levels come first.",
        priority: 1,
        active: true,
      },
      {
        ruleNumber: 2,
        category: "ENTRY",
        ruleName: "Stop Loss Placement",
        content: "Stops go beyond the manipulation extreme.",
        priority: 2,
        active: true,
      },
    ]);

    await generateAskResponse(
      {
        message: "Analyse this chart",
        sessionId: crypto.randomUUID(),
        image: "data:image/png;base64,Zm9vYmFy",
        history: [],
      },
      { generateTextImpl, getActiveAnalysisRulesImpl },
    );

    expect(getActiveAnalysisRulesImpl).toHaveBeenCalledOnce();
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    const rulesMessageIndex =
      call?.messages?.findIndex(
        (message) =>
          message.role === "system" &&
          typeof message.content === "string" &&
          message.content.startsWith("Apply these exact trading rules when analysing this chart:"),
      ) ?? -1;
    const userMessageIndex =
      call?.messages?.findIndex((message) => message.role === "user") ?? -1;

    expect(rulesMessageIndex).toBeGreaterThan(-1);
    expect(userMessageIndex).toBeGreaterThan(rulesMessageIndex);
    expect(call?.messages?.[rulesMessageIndex]).toEqual(
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("Rule 1 | FOUNDATION | Support and Resistance | Priority 1"),
      }),
    );
    expect(call?.messages?.[rulesMessageIndex]).toEqual(
      expect.objectContaining({
        content: expect.stringContaining("Rule 2 | ENTRY | Stop Loss Placement | Priority 2"),
      }),
    );
  });

  it("does not load analysis rules for text-only requests", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify(fallbackInsightCard),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;
    const getActiveAnalysisRulesImpl = vi.fn();

    await generateAskResponse(
      {
        message: "What is Gold doing?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl, getActiveAnalysisRulesImpl },
    );

    expect(getActiveAnalysisRulesImpl).not.toHaveBeenCalled();
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    expect(call?.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Apply these exact trading rules when analysing this chart:"),
        }),
      ]),
    );
  });

  it("sends image input as a file part when a chart is attached", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "chart",
        pattern: "Ascending Triangle",
        bias: "Bullish",
        entry: "4490-4495",
        stop: "4478",
        target: "4525",
        rr: "2.5 : 1",
        confidence: "Medium",
        verdict: "Wait for clean breakout confirmation.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Analyse this chart",
        sessionId: crypto.randomUUID(),
        image: "data:image/png;base64,Zm9vYmFy",
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data.type).toBe("chart");
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    expect(call?.messages).toBeDefined();
    if (!call?.messages) {
      throw new Error("Expected the model call to include messages.");
    }
    const lastMessage = call.messages.at(-1);
    expect(lastMessage).toEqual(
      expect.objectContaining({
        role: "user",
        content: expect.arrayContaining([
          expect.objectContaining({ type: "file", mediaType: "image/png" }),
          expect.objectContaining({ type: "text", text: "Analyse this chart" }),
        ]),
      }),
    );
  });

  it("defaults image-only asks to the standard chart prompt and normalizes chart bias", async () => {
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        type: "chart",
        pattern: "V-recovery",
        bias: "Long",
        entry: "21,880",
        stop: "21,370",
        target: "21,950",
        rr: "1.4:1",
        confidence: "Medium",
        verdict: "Wait for confirmation.",
      }),
      toolResults: [],
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "",
        sessionId: crypto.randomUUID(),
        image: "data:image/png;base64,Zm9vYmFy",
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data.type).toBe("chart");
    if (response.data.type !== "chart") {
      throw new Error("Expected a chart card.");
    }
    expect(response.data.bias).toBe("Bullish");
    const call = vi.mocked(generateTextImpl).mock.calls[0]?.[0];
    const lastMessage = call?.messages?.at(-1);
    expect(lastMessage).toEqual(
      expect.objectContaining({
        role: "user",
        content: expect.arrayContaining([
          expect.objectContaining({ type: "text", text: defaultAskImagePrompt }),
        ]),
      }),
    );
  });

  it("accepts a clean insight response for a non-chart image", async () => {
    const response = await generateAskResponse(
      {
        message: "",
        sessionId: crypto.randomUUID(),
        image: "data:image/png;base64,Zm9vYmFy",
        history: [],
      },
      {
        generateTextImpl: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            type: "insight",
            headline: "Need Trading Chart",
            body: "This image is not a trading chart I can analyse for setup, entry, stop, and target.",
            verdict: "Upload a trading chart or ask a trading question.",
          }),
          toolResults: [],
        }) as unknown as typeof import("ai").generateText,
      },
    );

    expect(response.data).toEqual({
      type: "insight",
      headline: "Need Trading Chart",
      body: "This image is not a trading chart I can analyse for setup, entry, stop, and target.",
      verdict: "Upload a trading chart or ask a trading question.",
    });
  });

  it("falls back to the fallback model when the primary fails after retries (overload)", async () => {
    const card = {
      type: "insight" as const,
      headline: "Fallback OK",
      body: "Body",
      verdict: "Verdict",
    };
    const generateTextImpl = vi
      .fn()
      .mockRejectedValueOnce(
        new RetryError({
          message: "Failed after 3 attempts. Last error: Overloaded",
          reason: "maxRetriesExceeded",
          errors: [new Error("Overloaded")],
        }),
      )
      .mockResolvedValueOnce({
        text: JSON.stringify(card),
        toolResults: [],
      }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What is Gold doing?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data).toEqual(card);
    expect(generateTextImpl).toHaveBeenCalledTimes(2);
    const firstModel = vi.mocked(generateTextImpl).mock.calls[0]?.[0]?.model;
    const secondModel = vi.mocked(generateTextImpl).mock.calls[1]?.[0]?.model;
    expect(firstModel).not.toBe(secondModel);
  });

  it("returns the existing tool card instead of rerunning on the fallback model when the primary fails late", async () => {
    const toolCard = {
      type: "briefing" as const,
      asset: "GOLD",
      price: "4736.30",
      change: "-0.86%",
      direction: "down" as const,
      level1: "4745.10",
      level2: "4734.70",
      event: null,
      verdict: "Gold is leaning heavy. Watch support for a break.",
    };

    const generateTextImpl = vi.fn().mockImplementationOnce(async (input) => {
      input.onStepFinish?.({
        stepNumber: 0,
        text: "",
        toolCalls: [],
        toolResults: [
          {
            toolName: "get_market_briefing",
            output: {
              card: toolCard,
              uiMeta: {
                marketSeries: [1, 2, 3],
                marketSourceLabel: "FMP",
              },
            },
          },
        ],
        finishReason: "tool-calls",
        usage: undefined,
      });

      throw new RetryError({
        message: "Failed after 3 attempts. Last error: Overloaded",
        reason: "maxRetriesExceeded",
        errors: [new Error("Overloaded")],
      });
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "What is Gold doing?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data).toEqual(toolCard);
    expect(response.uiMeta).toEqual({
      marketSeries: [1, 2, 3],
      marketSourceLabel: "FMP",
    });
    expect(generateTextImpl).toHaveBeenCalledTimes(1);
  });

  it("deduplicates final tool results already captured during step callbacks", async () => {
    const submitCardResult = {
      toolName: "submit_ask_card",
      output: {
        card: {
          type: "insight" as const,
          headline: "Iran On Edge",
          body: "Ceasefire risk is still fragile here.",
          verdict: "Trade the fragility, not the headline.",
        },
      },
    };

    const generateTextImpl = vi.fn().mockImplementation(async (input) => {
      input.onStepFinish?.({
        stepNumber: 0,
        text: "",
        toolCalls: [{ toolName: "submit_ask_card", input: {} }],
        toolResults: [submitCardResult],
        finishReason: "tool-calls",
        usage: undefined,
      });

      return {
        text: "",
        toolResults: [submitCardResult],
      };
    }) as unknown as typeof import("ai").generateText;

    const response = await generateAskResponse(
      {
        message: "Trump and Iran?",
        sessionId: crypto.randomUUID(),
        history: [],
      },
      { generateTextImpl },
    );

    expect(response.data).toEqual(submitCardResult.output.card);

    const toolResultsLog = vi.mocked(logger.info).mock.calls.find(
      ([message]) => message === "Tool results received.",
    );
    expect(toolResultsLog?.[1]).toMatchObject({
      count: 1,
      tools: ["submit_ask_card"],
    });
  });

  it("rejects unsupported image payloads", async () => {
    await expect(
      generateAskResponse({
        message: "Analyse this chart",
        sessionId: crypto.randomUUID(),
        image: "not-a-data-url",
        history: [],
      }),
    ).rejects.toThrow("Image must be a base64 data URL");
  });

  it("rejects unsupported image mime types", async () => {
    await expect(
      generateAskResponse({
        message: "Analyse this chart",
        sessionId: crypto.randomUUID(),
        image: "data:image/gif;base64,Zm9v",
        history: [],
      }),
    ).rejects.toThrow("Image must be a base64 data URL");
  });
});
