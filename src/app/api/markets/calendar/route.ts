import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/http/json-response";
import { getEconomicCalendarSnapshot } from "@/lib/markets/fmp-economic-calendar";
import { MARKETS_PRIVATE_CACHE_HEADERS, requireMarketsProSession } from "@/lib/markets/markets-api-auth";

export async function GET() {
  const access = await requireMarketsProSession();
  if (!access.ok) {
    return access.response;
  }

  try {
    const snapshot = await getEconomicCalendarSnapshot();
    return NextResponse.json(snapshot, {
      headers: MARKETS_PRIVATE_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load economic calendar.";
    return jsonApiError(500, "markets_calendar_failed", message);
  }
}
