import { NextResponse } from "next/server";

import { requireBrokerProSession } from "@/lib/broker/access";
import { MetaApiError } from "@/lib/broker/metaapi";
import { advanceBrokerSync, BrokerNotConfiguredError, BrokerSyncError, loadBrokerAccountRow } from "@/lib/broker/sync";
import { jsonApiError, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

/**
 * "Sync now" — one step of the engine the daily cron passes run: a parked account gets deployed
 * and answers `linking`, a connected one imports. The trader taps once and polls
 * GET /api/broker/account for the rest.
 *
 * It never parks: the pull pass parks whatever it finds running, so the worst case is one account
 * up until the next pull (≤12 h), and the 10-minute cooldown caps how often a tap pays the fee.
 */
export async function POST() {
  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  try {
    const row = await loadBrokerAccountRow(access.admin, access.userId);
    if (!row) {
      return jsonApiError(409, "broker_account_missing", "Connect a broker account first.");
    }

    const result = await advanceBrokerSync(access.admin, row, { manual: true });
    return NextResponse.json(result, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof BrokerNotConfiguredError) {
      return jsonApiError(409, "broker_awaiting_config", error.message);
    }

    logger.error("Broker sync failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });

    if (error instanceof BrokerSyncError) {
      return jsonApiError(502, "broker_sync_failed", error.message);
    }
    if (error instanceof MetaApiError) {
      return jsonApiError(502, "broker_sync_failed", "Your broker connection didn't answer. Try again shortly.");
    }
    return jsonApiError(500, "broker_sync_failed", "Could not sync your broker account right now.");
  }
}
