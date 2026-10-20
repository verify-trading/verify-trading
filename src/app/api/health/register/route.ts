import { NextResponse } from "next/server";

import { loadEntities, MIN_EXPECTED_ENTITIES, type PublicEntityType } from "@/lib/compare/entities";

export const dynamic = "force-dynamic";

/**
 * Register health check for uptime monitors: live record counts straight from Supabase (no cache).
 * 503 when a read fails or a count falls below the expected floor, so a broken data link is caught
 * before anyone notices the Compare pages shrinking.
 */
export async function GET() {
  const types: PublicEntityType[] = ["broker", "propfirm"];
  const counts: Partial<Record<PublicEntityType, number | null>> = {};
  let ok = true;
  for (const type of types) {
    try {
      counts[type] = (await loadEntities(type)).length;
      if (counts[type]! < MIN_EXPECTED_ENTITIES[type]) ok = false;
    } catch {
      counts[type] = null;
      ok = false;
    }
  }
  return NextResponse.json({ ok, counts, minimum: MIN_EXPECTED_ENTITIES }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
