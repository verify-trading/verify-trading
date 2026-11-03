import { NextResponse } from "next/server";

import { getPublicEntities, type PublicEntityType } from "@/lib/compare/entities";

const TYPES = new Set(["broker", "propfirm", "guru"]);

/**
 * Slim name list for the register search autocomplete. Only already-public
 * fields leave the server: name, slug, verdict. The entity list itself is
 * cached (getPublicEntities, 1h), and the CDN holds the response for the
 * same hour so typing never hits Supabase.
 */
export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") ?? "";
  if (!TYPES.has(type)) return NextResponse.json({ error: "unknown type" }, { status: 400 });
  const entities = await getPublicEntities(type as PublicEntityType);
  const items = entities.map((e) => ({ n: e.name, s: e.slug, v: e.verdict }));
  return NextResponse.json(items, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
