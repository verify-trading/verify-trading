import type { UIMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import { logger } from "@/lib/observability/logger";
import { classifyAskRouteError, getUserMessageForAskFailureCode } from "@/lib/ask/ask-failure";
import { jsonApiFailure } from "@/lib/http/json-response";
import type { AskStreamData, AskToolStatus } from "@/lib/ask/stream";
import {
  askRouteFailure,
  completeAskExchange,
  prepareAskRoute,
  type PreparedAskRoute,
} from "@/lib/ask/route-runtime";

type AskRouteMessage = UIMessage<unknown, AskStreamData>;

function readStringArg(
  args: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function buildToolStatus(toolName: string, rawArgs: unknown): AskToolStatus {
  const args = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
  const asset = readStringArg(args, "asset", "pair", "symbol");
  const entity = readStringArg(args, "name", "query");
  const timeframe = readStringArg(args, "timeframe");
  const side = readStringArg(args, "side", "direction");
  const url = readStringArg(args, "url");

  switch (toolName) {
    case "verify_entity":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Checking broker / firm",
        detail: entity ? `Reviewing ${entity}` : "Reviewing the entity details provided.",
      };
    case "get_market_briefing":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Fetching live market price",
        detail: asset
          ? `Pulling live levels for ${asset}${timeframe ? ` on ${timeframe}` : ""}.`
          : "Pulling live price and nearby levels.",
      };
    case "get_market_setup":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Building live setup",
        detail: asset
          ? `Mapping ${side ?? "trade"} levels for ${asset}${timeframe ? ` on ${timeframe}` : ""}.`
          : "Turning live market structure into an actionable setup.",
      };
    case "search_news":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Scanning headlines",
        detail: entity ? `Searching recent news for ${entity}.` : "Searching for fresh market-moving headlines.",
      };
    case "web_search":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Searching the web",
        detail: entity ? `Searching the web for ${entity}.` : "Searching the live web for the latest on this.",
      };
    case "web_fetch":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Reading a source",
        detail: url ? `Reading ${url}.` : "Reading the full page for more detail.",
      };
    case "get_economic_calendar":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Checking economic calendar",
        detail: "Reading scheduled macro events, impact, and release values.",
      };
    case "calculate_position_size":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Sizing the trade",
        detail: asset ? `Calculating risk-based size for ${asset}.` : "Calculating a risk-based position size.",
      };
    case "calculate_risk_reward":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Checking risk-reward",
        detail: "Measuring the reward multiple against the stop.",
      };
    case "calculate_pip_value":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Calculating pip value",
        detail: asset ? `Working out pip value for ${asset}.` : "Working out the pip value.",
      };
    case "calculate_margin_required":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Estimating margin",
        detail: asset ? `Estimating required margin for ${asset}.` : "Estimating how much margin the trade needs.",
      };
    case "calculate_profit_loss":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Calculating profit / loss",
        detail: "Running the trade outcome numbers.",
      };
    case "generate_projection":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Running projection",
        detail: "Projecting account growth over time.",
      };
    case "generate_growth_plan":
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Building growth plan",
        detail: "Setting realistic daily, weekly, and monthly targets.",
      };
    case "submit_ask_card":
      return {
        id: crypto.randomUUID(),
        phase: "finalizing",
        toolName,
        label: "Formatting final answer",
        detail: "Packaging the final card for display.",
      };
    default:
      return {
        id: crypto.randomUUID(),
        phase: "working",
        toolName,
        label: "Working through your request",
        detail: `Using ${toolName.replaceAll("_", " ")}.`,
      };
  }
}

function buildAskStreamResponse({
  parsedRequest,
  requestInput,
  persistence,
  refundReservation,
}: PreparedAskRoute) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream<AskRouteMessage>({
      execute: async ({ writer }) => {
        writer.write({
          type: "data-tool-status",
          data: {
            id: crypto.randomUUID(),
            phase: "thinking",
            label: "Thinking through your question",
            detail: requestInput.image
              ? "Reading your image context and deciding what evidence is needed."
              : "Understanding the request and deciding which checks to run.",
          },
          transient: true,
        });

        const response = await completeAskExchange({ parsedRequest, requestInput, persistence, refundReservation }, {
          onToolCall: ({ toolName, input }) => {
            writer.write({
              type: "data-tool-status",
              data: buildToolStatus(toolName, input),
              transient: true,
            });
          },
        });

        writer.write({
          type: "data-tool-status",
          data: {
            id: crypto.randomUUID(),
            phase: "finalizing",
            label: "Preparing final answer",
            detail: "Turning the working notes into the final card.",
          },
          transient: true,
        });

        const assistantPayload = JSON.stringify(response.data);

        writer.write({ type: "start" });
        writer.write({ type: "start-step" });
        writer.write({
          type: "data-session",
          data: {
            sessionId: response.sessionId,
            messageId: response.messageId,
          },
        });

        if (response.uiMeta) {
          writer.write({
            type: "data-ui-meta",
            data: response.uiMeta,
          });
        }

        writer.write({ type: "text-start", id: "card-1" });
        writer.write({
          type: "text-delta",
          id: "card-1",
          delta: assistantPayload,
        });
        writer.write({ type: "text-end", id: "card-1" });
        writer.write({ type: "finish-step" });
        writer.write({ type: "finish", finishReason: "stop" });
      },
      onError: (error) => {
        const { code } = classifyAskRouteError(error);

        logger.error("Ask response generation failed.", {
          error: error instanceof Error ? error.message : "unknown",
          code,
        });

        // Surface a safe, stable message — never the raw provider/internal string.
        return getUserMessageForAskFailureCode(code);
      },
    }),
  });
}

export async function POST(request: Request) {
  try {
    const prepared = await prepareAskRoute(request);
    return prepared.ok ? buildAskStreamResponse(prepared.value) : jsonApiFailure(prepared.failure);
  } catch (error) {
    return jsonApiFailure(askRouteFailure(error, "Ask response generation failed."));
  }
}
