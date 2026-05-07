import { NextResponse } from "next/server";

import type { EconomicCalendarSnapshot } from "@/lib/markets/economic-calendar";
import { jsonApiError } from "@/lib/http/json-response";
import { ECONOMIC_CALENDAR_CACHE_KEY } from "@/lib/markets/rapidapi-economic-calendar";
import { readCacheRow } from "@/lib/markets/twelve-data-adapter";
import { MARKETS_PRIVATE_CACHE_HEADERS, requireMarketsProSession } from "@/lib/markets/markets-api-auth";

export async function GET() {
  const access = await requireMarketsProSession();
  if (!access.ok) {
    return access.response;
  }

  try {
    const cached = await readCacheRow<EconomicCalendarSnapshot>(ECONOMIC_CALENDAR_CACHE_KEY);
    const snapshot: EconomicCalendarSnapshot = cached?.payload ?? {
      updatedAt: new Date().toISOString(),
      dayLabel: "Upcoming events",
      items: [],
    };

    return NextResponse.json(snapshot, {
      headers: MARKETS_PRIVATE_CACHE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load economic calendar.";
    return jsonApiError(500, "markets_calendar_failed", message);
  }
}
