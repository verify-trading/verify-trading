import { NextResponse } from "next/server";
import { z } from "zod";

import { getAskPersistence } from "@/lib/ask/persistence";
import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

const sessionIdParamSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId: raw } = await context.params;
  const parsed = sessionIdParamSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonApiError(400, "sessions_delete_invalid", "The session id is invalid.");
  }

  try {
    const session = await getSessionUser();
    if (!session) {
      return jsonUnauthorized("Sign in to manage Ask sessions.");
    }

    const persistence = getAskPersistence({ userId: session.user.id });
    await persistence.deleteSession(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Ask session delete failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return jsonApiError(500, "sessions_delete_unavailable", "Could not delete that session right now.");
  }
}
