import { NextRequest, NextResponse } from "next/server";

import { deriveQuoteFromSeries, getMarketSeries } from "@/lib/ask/market";
import {
  MARKETS_DASHBOARD_ASSETS,
  type MarketsAssetPayload,
  type MarketsSnapshot,
  type MarketsTimeframe,
} from "@/lib/markets/dashboard";

function parseTimeframe(value: string | null): MarketsTimeframe {
  if (value === "1D" || value === "1W" || value === "1M" || value === "3M" || value === "1Y") {
    return value;
  }

  return "1W";
}

export async function GET(request: NextRequest) {
  const timeframe = parseTimeframe(request.nextUrl.searchParams.get("timeframe"));

  /** One history fetch per asset keeps the dashboard simple and free-plan friendly. */
  const settled = await Promise.all(
    MARKETS_DASHBOARD_ASSETS.map(async (asset): Promise<MarketsAssetPayload> => {
      try {
        const series = await getMarketSeries(asset.query, timeframe);
        const quote = deriveQuoteFromSeries(series);
        return {
          id: asset.id,
          label: asset.label,
          quote,
          series,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load market data.";
        return {
          id: asset.id,
          label: asset.label,
          quote: null,
          series: null,
          error: message,
        };
      }
    }),
  );

  const snapshot: MarketsSnapshot = {
    updatedAt: new Date().toISOString(),
    timeframe,
    assets: settled,
  };

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
