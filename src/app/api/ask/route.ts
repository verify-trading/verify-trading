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

type ToolStatusArgs = {
  asset?: string;
  entity?: string;
  timeframe?: string;
  side?: string;
  url?: string;
};

type ToolStatusSpec = {
  label: string;
  detail: (args: ToolStatusArgs) => string;
  phase?: AskToolStatus["phase"];
};

const TOOL_STATUS: Record<string, ToolStatusSpec> = {
  verify_entity: {
    label: "Checking broker / firm",
    detail: ({ entity }) => (entity ? `Reviewing ${entity}` : "Reviewing the entity details provided."),
  },
  get_market_briefing: {
    label: "Fetching live market price",
    detail: ({ asset, timeframe }) =>
      asset
        ? `Pulling live levels for ${asset}${timeframe ? ` on ${timeframe}` : ""}.`
        : "Pulling live price and nearby levels.",
  },
  get_market_setup: {
    label: "Building live setup",
    detail: ({ asset, timeframe, side }) =>
      asset
        ? `Mapping ${side ?? "trade"} levels for ${asset}${timeframe ? ` on ${timeframe}` : ""}.`
        : "Turning live market structure into an actionable setup.",
  },
  search_news: {
    label: "Scanning headlines",
    detail: ({ entity }) =>
      entity ? `Searching recent news for ${entity}.` : "Searching for fresh market-moving headlines.",
  },
  web_search: {
    label: "Searching the web",
    detail: ({ entity, url }) =>
      url
        ? `Reading ${url}.`
        : entity
          ? `Searching the web for ${entity}.`
          : "Searching the live web for the latest on this.",
  },
  get_economic_calendar: {
    label: "Checking economic calendar",
    detail: () => "Reading scheduled macro events, impact, and release values.",
  },
  calculate_position_size: {
    label: "Sizing the trade",
    detail: ({ asset }) =>
      asset ? `Calculating risk-based size for ${asset}.` : "Calculating a risk-based position size.",
  },
  calculate_risk_reward: {
    label: "Checking risk-reward",
    detail: () => "Measuring the reward multiple against the stop.",
  },
  calculate_pip_value: {
    label: "Calculating pip value",
    detail: ({ asset }) => (asset ? `Working out pip value for ${asset}.` : "Working out the pip value."),
  },
  calculate_margin_required: {
    label: "Estimating margin",
    detail: ({ asset }) =>
      asset ? `Estimating required margin for ${asset}.` : "Estimating how much margin the trade needs.",
  },
  calculate_profit_loss: {
    label: "Calculating profit / loss",
    detail: () => "Running the trade outcome numbers.",
  },
  generate_projection: {
    label: "Running projection",
    detail: () => "Projecting account growth over time.",
  },
  generate_growth_plan: {
    label: "Building growth plan",
    detail: () => "Setting realistic daily, weekly, and monthly targets.",
  },
  submit_ask_card: {
    label: "Formatting final answer",
    detail: () => "Packaging the final card for display.",
    phase: "finalizing",
  },
};

function buildToolStatus(toolName: string, rawArgs: unknown): AskToolStatus {
  const args = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};
  const spec = TOOL_STATUS[toolName];

  return {
    id: crypto.randomUUID(),
    phase: spec?.phase ?? "working",
    toolName,
    label: spec?.label ?? "Working through your request",
    detail:
      spec?.detail({
        asset: readStringArg(args, "asset", "pair", "symbol"),
        entity: readStringArg(args, "name", "query"),
        timeframe: readStringArg(args, "timeframe"),
        side: readStringArg(args, "side", "direction"),
        url: readStringArg(args, "url"),
      }) ?? `Using ${toolName.replaceAll("_", " ")}.`,
  };
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
