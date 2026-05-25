import { describe, expect, it } from "vitest";

import {
  selectAskModelRoutingDecision,
  shouldUseSimpleAskModel,
  type AskModelRoutingReason,
  type AskToolPolicy,
} from "@/lib/ask/service/model-routing";

type RoutingCase = {
  name: string;
  message: string;
  hasImage?: boolean;
  hasTradingContext?: boolean;
  modelClass: "simple" | "primary";
  reason: AskModelRoutingReason;
  toolPolicy: AskToolPolicy;
};

describe("ask model routing", () => {
  const routingCases: RoutingCase[] = [
    {
      name: "straightforward education stays on the simple model",
      message: "what is spread in forex?",
      modelClass: "simple",
      reason: "straightforward_education",
      toolPolicy: "none",
    },
    {
      name: "broker verification uses the verification-only simple policy",
      message: "is completely unknown broker regulated?",
      modelClass: "simple",
      reason: "broker_verification_intent",
      toolPolicy: "verification",
    },
    {
      name: "calculator intent uses the calculator-only simple policy",
      message: "calculate lot size for 1% risk on EURUSD",
      modelClass: "simple",
      reason: "calculator_intent",
      toolPolicy: "calculator",
    },
    {
      name: "single-asset market shorthand goes to the primary model",
      message: "gold?",
      modelClass: "primary",
      reason: "ambiguous_market_context",
      toolPolicy: "full",
    },
    {
      name: "direct forex-pair shorthand goes to the primary model",
      message: "EURUSD?",
      modelClass: "primary",
      reason: "ambiguous_market_context",
      toolPolicy: "full",
    },
    {
      name: "bare levels prompt goes to the primary model",
      message: "levels?",
      modelClass: "primary",
      reason: "ambiguous_market_context",
      toolPolicy: "full",
    },
    {
      name: "active trading context keeps even simple follow-ups on the primary model",
      message: "what is spread in forex?",
      hasTradingContext: true,
      modelClass: "primary",
      reason: "active_trading_context",
      toolPolicy: "full",
    },
    {
      name: "image prompts go to the primary model",
      message: "what is spread in forex?",
      hasImage: true,
      modelClass: "primary",
      reason: "image_analysis",
      toolPolicy: "full",
    },
    {
      name: "complex market analysis goes to the primary model",
      message:
        "Analyze how gold and EURUSD correlations could affect my weekly thesis and portfolio risk.",
      modelClass: "primary",
      reason: "complex_request_shape",
      toolPolicy: "full",
    },
    {
      name: "complex trader-state analysis goes to the primary model",
      message: "Review why I keep moving stops after losses and compare the habits I should track.",
      modelClass: "primary",
      reason: "complex_request_shape",
      toolPolicy: "full",
    },
  ];

  it.each(routingCases)("$name", (routingCase) => {
    const decision = selectAskModelRoutingDecision({
      message: routingCase.message,
      hasImage: routingCase.hasImage,
      hasTradingContext: routingCase.hasTradingContext,
    });

    expect(decision).toMatchObject({
      modelClass: routingCase.modelClass,
      reason: routingCase.reason,
      toolPolicy: routingCase.toolPolicy,
    });
    expect(
      shouldUseSimpleAskModel(routingCase.message, routingCase.hasImage, {
        hasTradingContext: routingCase.hasTradingContext,
      }),
    ).toBe(routingCase.modelClass === "simple");
  });
});
