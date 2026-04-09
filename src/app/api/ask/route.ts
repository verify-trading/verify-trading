import type { UIMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { askRequestSchema } from "@/lib/ask/contracts";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { logger } from "@/lib/observability/logger";
import { getAskPersistence, type AskPersistence } from "@/lib/ask/persistence";
import { classifyAskRouteError } from "@/lib/ask/ask-failure";
import { getSessionUser } from "@/lib/auth/session";
import { reserveAskQuery } from "@/lib/rate-limit/reserve-ask-query";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";
import { generateAskResponse } from "@/lib/ask/service";
import type { AskStreamData, AskToolStatus } from "@/lib/ask/stream";
import { AskValidationError } from "@/lib/ask/validation-error";

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
}: {
  parsedRequest: ReturnType<typeof askRequestSchema.parse>;
  requestInput: Parameters<typeof generateAskResponse>[0];
  persistence: AskPersistence;
}) {
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

        const response = await generateAskResponse(requestInput, {}, {
          onToolCall: ({ toolName, input }) => {
            writer.write({
              type: "data-tool-status",
              data: buildToolStatus(toolName, input),
              transient: true,
            });
          },
        });

        try {
          await persistence.saveExchange({
            sessionId: response.sessionId,
            userMessage: parsedRequest.message,
            assistantCard: response.data,
            assistantUiMeta: response.uiMeta,
            attachmentMeta: parsedRequest.attachmentMeta ?? null,
            userImageDataUrl: parsedRequest.image ?? null,
          });
        } catch (error) {
          logger.warn("Could not persist Ask exchange.", {
            sessionId: response.sessionId,
            error: error instanceof Error ? error.message : "unknown",
          });
        }

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
        const { code, message } = classifyAskRouteError(error);

        logger.error("Ask response generation failed.", {
          error: error instanceof Error ? error.message : "unknown",
          code,
        });

        return message;
      },
    }),
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "The Ask request body is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Sign in to use Ask.",
        },
        { status: 401 },
      );
    }

    const parsedRequest = askRequestSchema.parse(body);
    const reserve = await reserveAskQuery(session.supabase);
    if (!reserve.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          code: reserve.reason,
          message:
            reserve.reason === "daily_limit"
              ? `You have used today’s ${FREE_DAILY_ASK_LIMIT} free chats.`
              : "Could not verify your usage limit.",
          remaining: reserve.remaining ?? 0,
        },
        { status: 429 },
      );
    }

    const sessionId =
      parsedRequest.sessionId ??
      parsedRequest.chatSessionId ??
      crypto.randomUUID();
    const persistence = getAskPersistence({ userId: session.user.id });
    let history = parsedRequest.history;

    try {
      const persistedHistory = await persistence.loadHistory(sessionId);
      if (persistedHistory.length > 0) {
        history = persistedHistory;
      }
    } catch (error) {
      logger.warn("Could not load Ask history before generation.", {
        sessionId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    const requestInput = {
      ...parsedRequest,
      message: parsedRequest.message || (parsedRequest.image ? defaultAskImagePrompt : ""),
      sessionId,
      history,
    };

    return buildAskStreamResponse({
      parsedRequest,
      requestInput,
      persistence,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "The Ask request body is invalid.",
        },
        { status: 400 },
      );
    }

    if (error instanceof AskValidationError) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: error.message,
        },
        { status: 400 },
      );
    }

    const { code, message } = classifyAskRouteError(error);

    logger.error("Ask response generation failed.", {
      error: error instanceof Error ? error.message : "unknown",
      code,
    });

    return NextResponse.json(
      {
        error: "ask_failed",
        code,
        message,
      },
      { status: 502 },
    );
  }
}
