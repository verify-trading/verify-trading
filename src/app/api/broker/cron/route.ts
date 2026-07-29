import { NextResponse } from "next/server";

import { runBrokerSyncPass } from "@/lib/broker/sync";
import { requireCronSecret } from "@/lib/http/cron-auth";
import { logger } from "@/lib/observability/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Two pg_cron jobs hit this (supabase/migration_29_broker_cron.sql): `?pass=wake` at 06:00 / 18:00
 * UTC, `?pass=pull` at 06:35 / 18:35. Separate runs because a deploy takes 30 s – 3 min and a
 * serverless function shouldn't sit there waiting for it; runBrokerSyncPass owns what each does.
 * Auth is the same shared bearer secret the markets cron uses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The pull pass is what stops accounts billing. Dying at the default limit halfway through
// the list would leave the tail deployed until the next pull, so buy the full 300 s.
export const maxDuration = 300;

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const pass = new URL(request.url).searchParams.get("pass");
  if (pass !== "wake" && pass !== "pull") {
    return NextResponse.json({ error: "pass must be wake or pull" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    logger.error("broker cron: admin client unavailable");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const startedAt = Date.now();
  try {
    const outcome = await runBrokerSyncPass(admin, pass);
    const payload = { ok: true, pass, ...outcome, durationMs: Date.now() - startedAt };
    logger.info("broker cron completed", payload);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("broker cron failed", { pass, error: message });
    return NextResponse.json({ ok: false, pass, error: message }, { status: 500 });
  }
}
