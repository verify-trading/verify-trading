import { ZodError } from "zod";

import { classifyAskRouteError } from "@/lib/ask/ask-failure";
import { askRequestSchema, type AskResponse, type AskSessionMemory } from "@/lib/ask/contracts";
import { getAskPersistence, type AskPersistence } from "@/lib/ask/persistence";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { generateAskCascadeResponse } from "@/lib/ask/cascade";
import { generateAskResponse, type AskGenerationCallbacks } from "@/lib/ask/service";
import { buildUpdatedSessionMemory } from "@/lib/ask/session-memory";
import { AskValidationError } from "@/lib/ask/validation-error";
import { getSessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { reserveAskQuery } from "@/lib/rate-limit/reserve-ask-query";
import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

type ParsedAskRequest = ReturnType<typeof askRequestSchema.parse>;
type AskRequestInput = Parameters<typeof generateAskResponse>[0];

export type PreparedAskRoute = {
  parsedRequest: ParsedAskRequest;
  requestInput: AskRequestInput;
  persistence: AskPersistence;
};

export type AskRouteFailure = {
  error: "invalid_request" | "unauthorized" | "rate_limited" | "ask_failed";
  status: number;
  message: string;
  code?: string;
  remaining?: number;
};

type PreparedResult =
  | { ok: true; value: PreparedAskRoute }
  | { ok: false; failure: AskRouteFailure };

export async function prepareAskRoute(request: Request, logScope = "Ask"): Promise<PreparedResult> {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false, failure: { error: "unauthorized", status: 401, message: "Sign in to use Ask." } };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, failure: invalidAskRequest() };
  }

  const parsedRequest = askRequestSchema.parse(body);
  const reserve = await reserveAskQuery(session.supabase);
  if (!reserve.ok) {
    return {
      ok: false,
      failure: {
        error: "rate_limited",
        status: 429,
        code: reserve.reason,
        message: getRateLimitMessage(reserve.reason),
        remaining: reserve.remaining ?? 0,
      },
    };
  }

  const sessionId = parsedRequest.sessionId ?? parsedRequest.chatSessionId ?? crypto.randomUUID();
  const persistence = getAskPersistence({ userId: session.user.id });
  const [historyResult, memoryResult] = await Promise.allSettled([
    persistence.loadHistory(sessionId),
    persistence.loadSessionMemory(sessionId),
  ]);

  if (historyResult.status === "rejected") {
    logger.warn(`Could not load ${logScope} history before generation.`, {
      sessionId,
      error: historyResult.reason instanceof Error ? historyResult.reason.message : "unknown",
    });
  }

  if (memoryResult.status === "rejected") {
    logger.warn(`Could not load ${logScope} session memory before generation.`, {
      sessionId,
      error: memoryResult.reason instanceof Error ? memoryResult.reason.message : "unknown",
    });
  }

  const history = historyResult.status === "fulfilled" && historyResult.value.length > 0
    ? historyResult.value
    : parsedRequest.history;
  const sessionMemory = memoryResult.status === "fulfilled"
    ? memoryResult.value
    : parsedRequest.sessionMemory ?? null;

  return {
    ok: true,
    value: {
      parsedRequest,
      persistence,
      requestInput: {
        ...parsedRequest,
        message: parsedRequest.message || (parsedRequest.image ? defaultAskImagePrompt : ""),
        sessionId,
        sessionMemory,
        history,
      },
    },
  };
}

/**
 * The retrieval + Haiku-first cascade pipeline is the default. Set
 * ASK_PIPELINE=legacy to fall back to the older single-model pipeline.
 */
function isCascadePipelineEnabled() {
  return process.env.ASK_PIPELINE !== "legacy";
}

export async function completeAskExchange(
  prepared: PreparedAskRoute,
  callbacks?: AskGenerationCallbacks,
): Promise<AskResponse> {
  const generate = isCascadePipelineEnabled()
    ? generateAskCascadeResponse
    : generateAskResponse;
  const response = await generate(prepared.requestInput, {}, callbacks);
  await saveAskExchangeBestEffort(prepared, response);
  return response;
}

async function saveAskExchangeBestEffort(prepared: PreparedAskRoute, response: AskResponse) {
  let sessionMemory: AskSessionMemory | null | undefined;

  try {
    sessionMemory = buildUpdatedSessionMemory({
      history: prepared.requestInput.history,
      userMessage: prepared.parsedRequest.message,
      assistantCard: response.data,
      previousMemory: prepared.requestInput.sessionMemory,
      lastUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn("Could not build Ask session memory.", {
      sessionId: response.sessionId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  try {
    await prepared.persistence.saveExchange({
      sessionId: response.sessionId,
      userMessage: prepared.parsedRequest.message,
      assistantCard: response.data,
      assistantUiMeta: response.uiMeta,
      attachmentMeta: prepared.parsedRequest.attachmentMeta ?? null,
      ...(sessionMemory !== undefined ? { sessionMemory } : {}),
      userImageDataUrl: prepared.parsedRequest.image ?? null,
    });
  } catch (error) {
    logger.warn("Could not persist Ask exchange.", {
      sessionId: response.sessionId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function askRouteFailure(error: unknown, logMessage: string): AskRouteFailure {
  if (error instanceof ZodError) {
    return invalidAskRequest();
  }

  if (error instanceof AskValidationError) {
    return { error: "invalid_request", status: 400, message: error.message };
  }

  const { code, message } = classifyAskRouteError(error);
  logger.error(logMessage, {
    error: error instanceof Error ? error.message : "unknown",
    code,
  });

  return { error: "ask_failed", status: 502, code, message };
}

function invalidAskRequest(): AskRouteFailure {
  return { error: "invalid_request", status: 400, message: "The Ask request body is invalid." };
}

function getRateLimitMessage(reason: string) {
  if (reason === "daily_limit") {
    return `You have used today’s ${FREE_DAILY_ASK_LIMIT} free chats.`;
  }

  if (reason === "pro_fair_use_limit") {
    return `You have reached today’s ${PRO_DAILY_ASK_LIMIT} Pro fair-use chats.`;
  }

  return "Could not verify your usage limit.";
}
