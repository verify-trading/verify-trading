import { NextResponse } from "next/server";
import { z } from "zod";

import { getAskPersistence } from "@/lib/ask/persistence";
import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

const sessionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
  cursor: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  let query;

  try {
    const { searchParams } = new URL(request.url);
    query = sessionQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });
  } catch {
    return jsonApiError(400, "sessions_request_invalid", "The Ask sessions request is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to load Ask sessions.");
    }

    const persistence = getAskPersistence({ userId: session.user.id });
    const page = await persistence.listSessions(query.limit, query.cursor ?? null);

    return NextResponse.json(page);
  } catch (error) {
    logger.error("Ask sessions request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "sessions_unavailable", "Could not load Ask sessions right now.");
  }
}
