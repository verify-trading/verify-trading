import { NextResponse } from "next/server";

import { logger } from "@/lib/observability/logger";

/**
 * The shared bearer gate every Vercel cron route sits behind. Returns the 401 to send
 * back, or null when the request may proceed.
 *
 * A missing CRON_SECRET fails CLOSED in production and open everywhere else. These
 * endpoints spend money — an unauthenticated GET ?pass=wake would deploy, and bill, every
 * connected account — so a misconfigured production deploy has to be shut, not open. Dev
 * and preview keep the open door because a local run has no secret to send.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const path = new URL(request.url).pathname;
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      logger.error("cron secret missing in production", { path });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    logger.warn("cron unauthorized", {
      path,
      hasAuthorizationHeader: request.headers.has("authorization"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
