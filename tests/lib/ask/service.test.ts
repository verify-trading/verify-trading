import { RetryError } from "ai";
import { describe, expect, it, vi } from "vitest";

import { fallbackInsightCard } from "@/lib/ask/contracts";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { generateAskResponse } from "@/lib/ask/service";

describe("generateAskResponse", () => {
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

  it("short-circuits clear market entry prompts into a setup card", async () => {
    const generateTextImpl = vi.fn();
    const getMarketQuoteImpl = vi.fn().mockResolvedValue({
      asset: "GOLD / XAUUSD",
      symbol: "XAU/USD",
      price: 4645.1,
      changePercent: -0.1,
      direction: "down",
      isMarketOpen: true,
    });
    const getMarketSeriesImpl = vi.fn().mockResolvedValue({
      asset: "GOLD / XAUUSD",
      symbol: "XAU/USD",
      timeframe: "1W",
      closeValues: [4640.0, 4645.1, 4649.77],
      resistance: 4649.77,
      support: 4640.0,
    });

    const response = await generateAskResponse(
      {
        message: "What price should I buy gold at?",
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
    expect(response.data.type).toBe("setup");
    if (response.data.type !== "setup") {
      throw new Error("Expected a setup card.");
    }
    expect(response.data.asset).toBe("GOLD / XAUUSD");
    expect(response.data.bias).toBe("Bullish");
    expect(response.data.entry).toBe("4649.77");
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

  it("does not surface briefing ui metadata on non-briefing cards", async () => {
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

    expect(response.data.type).toBe("briefing");
    expect(response.uiMeta?.marketSeries).toBeDefined();
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
