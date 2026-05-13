import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/http/json-response";
import type { MarketIntelligenceSnapshot } from "@/lib/markets/market-intelligence";
import { DAILY_MARKET_BRIEF_CACHE_KEY } from "@/lib/markets/daily-brief";
import { MARKETS_PRIVATE_CACHE_HEADERS, requireMarketsProSession } from "@/lib/markets/markets-api-auth";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";

export async function GET() {
  const access = await requireMarketsProSession();
  if (!access.ok) {
    return access.response;
  }

  try {
    const [cached, dailyBriefCache] = await Promise.all([
      readCacheRow<MarketIntelligenceSnapshot>("intelligence:news"),
      readCacheRow<NonNullable<MarketIntelligenceSnapshot["dailyBrief"]>>(DAILY_MARKET_BRIEF_CACHE_KEY),
    ]);
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
      dailyBrief: dailyBriefCache?.payload ?? cached.payload.dailyBrief ?? null,
    };

    return NextResponse.json(snapshot, {
      headers: MARKETS_PRIVATE_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load market intelligence.";
    return jsonApiError(500, "markets_intelligence_failed", message);
  }
}
