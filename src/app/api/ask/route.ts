import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  askRequestSchema,
  type AskResponse,
} from "@/lib/ask/contracts";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { logger } from "@/lib/observability/logger";
import { getAskPersistence } from "@/lib/ask/persistence";
import { generateAskResponse } from "@/lib/ask/service";
import { AskValidationError } from "@/lib/ask/validation-error";

function buildAskStreamResponse(response: AskResponse) {
  const assistantPayload = JSON.stringify(response.data);

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
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
    const parsedRequest = askRequestSchema.parse(body);
    const sessionId =
      parsedRequest.sessionId ??
      parsedRequest.chatSessionId ??
      crypto.randomUUID();
    const persistence = getAskPersistence();
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

    const response = await generateAskResponse(requestInput);

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

    return buildAskStreamResponse(response);
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

    logger.error("Ask response generation failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: "ask_failed",
        message: "Could not generate an Ask response right now.",
      },
      { status: 502 },
    );
  }
}
