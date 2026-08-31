import { after } from "next/server";
import { ZodError } from "zod";

import { classifyAskRouteError, getUserMessageForAskFailureCode } from "@/lib/ask/ask-failure";
import { askRequestSchema, type AskResponse, type AskSessionMemory } from "@/lib/ask/contracts";
import { getAskPersistence, type AskPersistence } from "@/lib/ask/persistence";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import { generateAskResponse } from "@/lib/ask/pipeline";
import {
  isAskCacheCandidate,
  maybeCacheAskResponse,
  readCachedAskResponse,
} from "@/lib/ask/response-cache";
import type { AskGenerationCallbacks } from "@/lib/ask/service/types";
import { buildUpdatedSessionMemory } from "@/lib/ask/session-memory";
import { AskValidationError } from "@/lib/ask/validation-error";
import { getSessionUser } from "@/lib/auth/session";
import { AI_CONSENT_KEY, hasAiConsent } from "@/lib/ai/consent";
import { logger } from "@/lib/observability/logger";
import { refundAskQuery, reserveAskQuery } from "@/lib/rate-limit/reserve-ask-query";
import { FREE_DAILY_ASK_LIMIT, PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

type ParsedAskRequest = ReturnType<typeof askRequestSchema.parse>;
type AskRequestInput = Parameters<typeof generateAskResponse>[0];

export type PreparedAskRoute = {
  parsedRequest: ParsedAskRequest;
  requestInput: AskRequestInput;
  persistence: AskPersistence;
  /** Returns the reserved daily query if generation fails. Best-effort, never throws. */
  refundReservation: () => Promise<void>;
};

export type AskRouteFailure = {
  error: "invalid_request" | "unauthorized" | "ai_consent_required" | "rate_limited" | "ask_failed";
  status: number;
  message: string;
  code?: string;
  remaining?: number;
};

type PreparedResult =
  | { ok: true; value: PreparedAskRoute }
  | { ok: false; failure: AskRouteFailure };

export async function prepareAskRoute(
  request: Request,
  logScope = "Ask",
  requireAiConsent = false,
): Promise<PreparedResult> {
  const session = await getSessionUser();
  if (!session) {
    return { ok: false, failure: { error: "unauthorized", status: 401, message: "Sign in to use Ask." } };
  }
  if (requireAiConsent && !(await hasAiConsent(session.supabase, session.user.id, AI_CONSENT_KEY))) {
    return {
      ok: false,
      failure: {
        error: "ai_consent_required",
        status: 403,
        message: "Allow AI data sharing before using Ask.",
      },
    };
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
      refundReservation: () => refundAskQuery(session.supabase),
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

export async function completeAskExchange(
  prepared: PreparedAskRoute,
  callbacks?: AskGenerationCallbacks,
): Promise<AskResponse> {
  // Bare single-entity lookups ("is alpha futures legit") are served from the
  // shared response cache when a fresh answer for the same register row
  // exists — zero model cost, sub-second response. The exchange still counts
  // against the daily quota and still lands in the user's session history, so
  // a hit is indistinguishable from a generated answer everywhere else. The
  // sync pre-gate keeps non-cacheable requests (images, follow-ups) off the
  // async cache path entirely.
  const cacheCandidate = isAskCacheCandidate(prepared.requestInput);
  if (cacheCandidate) {
    const cached = await readCachedAskResponse(prepared.requestInput);
    if (cached) {
      const response: AskResponse = {
        data: cached.data,
        uiMeta: cached.uiMeta,
        // Same fallback chain as generateAskResponse (prepareAskRoute always
        // sets sessionId, but the request type keeps it optional).
        sessionId:
          prepared.requestInput.sessionId ??
          prepared.requestInput.chatSessionId ??
          crypto.randomUUID(),
        messageId: crypto.randomUUID(),
      };
      await runAfterResponse(() => saveAskExchangeBestEffort(prepared, response));
      return response;
    }
  }

  let response: AskResponse;
  try {
    response = await generateAskResponse(prepared.requestInput, {}, callbacks);
  } catch (error) {
    // Generation failed — refund the reserved daily query so the user isn't charged.
    await prepared.refundReservation();
    throw error;
  }

  await runAfterResponse(async () => {
    await saveAskExchangeBestEffort(prepared, response);
    if (cacheCandidate) await maybeCacheAskResponse(prepared.requestInput, response);
  });
  return response;
}

/**
 * Runs post-response work without making the caller wait for it.
 *
 * The answer is already complete by this point, so awaiting two more Supabase round trips
 * only adds latency the user feels. Plain fire-and-forget is unsafe — the serverless
 * runtime can freeze the moment the response resolves — so `after` is used to keep the
 * invocation alive until the work finishes.
 *
 * `after` requires a Next request scope and throws without one. Callers here run inside
 * a `try` that converts any throw into a failure response, so an unscoped call would turn
 * a perfectly good answer into an error. Fall back to awaiting instead: correct
 * everywhere, just without the latency win outside a request lifecycle.
 */
async function runAfterResponse(work: () => Promise<void>) {
  try {
    after(work);
  } catch {
    await work();
  }
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

  const { code } = classifyAskRouteError(error);
  logger.error(logMessage, {
    error: error instanceof Error ? error.message : "unknown",
    code,
  });

  // Never return the raw provider/internal message to the client — map to a safe one.
  return { error: "ask_failed", status: 502, code, message: getUserMessageForAskFailureCode(code) };
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
