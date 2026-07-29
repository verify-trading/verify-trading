import { NextResponse } from "next/server";
import { z } from "zod";

import { requireBrokerProSession } from "@/lib/broker/access";
import { searchServers } from "@/lib/broker/metaapi";
import { jsonApiError, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { logger } from "@/lib/observability/logger";

/**
 * Broker-server picker for the connect screen. The MT server name has to be exact and
 * has to be known before the account is created, so the trader searches for it here
 * (MetaApi's known-server list) rather than typing it from memory.
 */

const querySchema = z.object({
  platform: z.enum(["mt4", "mt5"]),
  query: z.string().trim().max(60).optional().default(""),
});

/** One or two letters match half the brokers on earth — not worth a round trip. */
const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return jsonApiError(400, "broker_servers_request_invalid", "The broker server search is invalid.");
  }

  const access = await requireBrokerProSession();
  if (!access.ok) return access.response;

  if (parsed.data.query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ servers: [] }, { headers: PRIVATE_CACHE_HEADERS });
  }

  try {
    const servers = await searchServers(parsed.data.platform, parsed.data.query);
    return NextResponse.json({ servers }, { headers: PRIVATE_CACHE_HEADERS });
  } catch (error) {
    logger.error("Broker server search failed.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return jsonApiError(502, "broker_servers_unavailable", "Could not search broker servers right now.");
  }
}
