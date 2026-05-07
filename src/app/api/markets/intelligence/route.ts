import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/http/json-response";
import type { MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";
import { MARKETS_PRIVATE_CACHE_HEADERS, requireMarketsProSession } from "@/lib/markets/markets-api-auth";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

export async function GET() {
  const access = await requireMarketsProSession();
  if (!access.ok) {
    return access.response;
  }

  try {
    const cached = await readCacheRow<MarketIntelligenceSnapshot>("intelligence:news");
    if (!cached?.payload) {
      return jsonApiError(
        503,
        "market_intelligence_cache_empty",
        "Market intelligence is warming up. Please try again shortly.",
      );
    }

    const snapshot: MarketIntelligenceSnapshot = {
      ...cached.payload,
      updatedAt: cached.payload.updatedAt || cached.fetchedAt || new Date().toISOString(),
    };

    return NextResponse.json(snapshot, {
      headers: MARKETS_PRIVATE_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load market intelligence.";
    return jsonApiError(500, "markets_intelligence_failed", message);
  }
}
