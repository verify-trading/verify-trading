import { NextResponse } from "next/server";
import { z } from "zod";

import { getAskPersistence } from "@/lib/ask/persistence";
import { getSessionUser } from "@/lib/auth/session";
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
    return NextResponse.json(
      {
        error: "sessions_request_invalid",
        message: "The Ask sessions request is invalid.",
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
          message: "Sign in to load Ask sessions.",
        },
        { status: 401 },
      );
    }

    const persistence = getAskPersistence({ userId: session.user.id });
    const page = await persistence.listSessions(query.limit, query.cursor ?? null);

    return NextResponse.json(page);
  } catch (error) {
    logger.error("Ask sessions request failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: "sessions_unavailable",
        message: "Could not load Ask sessions right now.",
      },
      { status: 500 },
    );
  }
}
