import { NextRequest, NextResponse } from "next/server";

import { deriveQuoteFromSeries, getMarketSeries } from "@/lib/ask/market";
import { getSessionUser } from "@/lib/auth/session";
import { jsonApiError, jsonUnauthorized } from "@/lib/http/json-response";
import {
  MARKETS_DASHBOARD_ASSETS,
  type MarketsAssetPayload,
  type MarketsSnapshot,
  type MarketsTimeframe,
} from "@/lib/markets/dashboard";

type ProfileTierRow = {
  tier: string | null;
};

function parseTimeframe(value: string | null): MarketsTimeframe {
  if (value === "1D" || value === "1W" || value === "1M" || value === "3M" || value === "1Y") {
    return value;
  }

  return "1W";
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser();

  if (!session) {
    return jsonUnauthorized("Sign in to view Markets.");
  }

  const profileResult = await session.supabase
    .from("profiles")
    .select("tier")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileResult.error) {
    return jsonApiError(500, "markets_access_failed", profileResult.error.message);
  }

  if (((profileResult.data as ProfileTierRow | null)?.tier ?? "free") !== "pro") {
    return jsonApiError(403, "pro_required", "Upgrade to Pro to unlock Markets.");
  }

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
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
