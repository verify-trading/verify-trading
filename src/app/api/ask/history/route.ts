import { NextResponse } from "next/server";
import { z } from "zod";

import { getAskPersistence } from "@/lib/ask/persistence";
import { decodeHistoryCursor } from "@/lib/ask/persistence/shared";
import { logger } from "@/lib/observability/logger";

const historyQuerySchema = z.object({
  sessionId: z.string().uuid(),
  cursor: z.string().trim().min(1).nullable().optional(),
  limit: z.coerce.number().int().min(10).max(40).optional().default(20),
});

export async function GET(request: Request) {
  let query;

  try {
    const { searchParams } = new URL(request.url);
    query = historyQuerySchema.parse({
      sessionId: searchParams.get("sessionId"),
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit") ?? undefined,
    });

    if (query.cursor && !decodeHistoryCursor(query.cursor)) {
      throw new Error("Invalid Ask history cursor.");
    }
  } catch {
    return NextResponse.json(
      {
        error: "history_request_invalid",
        message: "The Ask history request is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const persistence = getAskPersistence();
    const page = await persistence.loadThreadPage(query.sessionId, {
      cursor: query.cursor ?? null,
      limit: query.limit,
    });

    return NextResponse.json(page);
  } catch (error) {
    logger.error("Ask history request failed.", {
      sessionId: query.sessionId,
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: "history_unavailable",
        message: "Could not load Ask history right now.",
      },
      { status: 500 },
    );
  }
}
