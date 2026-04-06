import { NextResponse } from "next/server";
import { z } from "zod";

import { getAskPersistence } from "@/lib/ask/persistence";
import { logger } from "@/lib/observability/logger";

const sessionIdParamSchema = z.string().uuid();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId: raw } = await context.params;
  const parsed = sessionIdParamSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "sessions_delete_invalid",
        message: "The session id is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    await getAskPersistence().deleteSession(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Ask session delete failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: "sessions_delete_unavailable",
        message: "Could not delete that session right now.",
      },
      { status: 500 },
    );
  }
}
