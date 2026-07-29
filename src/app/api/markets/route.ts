import { NextResponse } from "next/server";

import { jsonApiError, PRIVATE_CACHE_HEADERS } from "@/lib/http/json-response";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";
import { requireMarketsSession } from "@/lib/markets/markets-api-auth";
import type { TwelveMarketsSnapshot } from "@/lib/markets/twelve-markets-data";

export async function GET() {
  // Charts/price snapshot is the free teaser: any signed-in user. The Pro-only
  // data (intelligence, calendar) stays gated in its own routes.
  const access = await requireMarketsSession();
  if (!access.ok) {
    return access.response;
  }

  try {
    const [quotesData, sparklinesData, series1D, series1W, series1M, series3M] = await Promise.all([
      readCacheRow<{ quotes: TwelveMarketsSnapshot["quotes"] }>("quotes:all"),
      readCacheRow<{ sparklines: Record<string, number[]> }>("sparklines:all"),
      readCacheRow<{ series: Record<string, number[]> }>("series:1D"),
      readCacheRow<{ series: Record<string, number[]> }>("series:1W"),
      readCacheRow<{ series: Record<string, number[]> }>("series:1M"),
      readCacheRow<{ series: Record<string, number[]> }>("series:3M"),
    ]);

    const snapshot: TwelveMarketsSnapshot = {
      updatedAt: quotesData?.fetchedAt ?? series1D?.fetchedAt ?? sparklinesData?.fetchedAt ?? null,
      quotes: quotesData?.payload.quotes ?? {},
      sparklines: series1D?.payload.series ?? sparklinesData?.payload.sparklines ?? {},
      seriesByTimeframe: {
        ...(series1D?.payload.series
          ? { "1D": series1D.payload.series }
          : sparklinesData?.payload.sparklines
            ? { "1D": sparklinesData.payload.sparklines }
            : {}),
        ...(series1W?.payload.series ? { "1W": series1W.payload.series } : {}),
        ...(series1M?.payload.series ? { "1M": series1M.payload.series } : {}),
        ...(series3M?.payload.series ? { "3M": series3M.payload.series } : {}),
      },
    };

    return NextResponse.json(snapshot, {
      headers: PRIVATE_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load market data.";
    return jsonApiError(500, "markets_failed", message);
  }
}
