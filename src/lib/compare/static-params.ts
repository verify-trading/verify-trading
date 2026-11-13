import { getPublicEntities, type PublicEntityType } from "@/lib/compare/entities";
import { pairsForType, vsPath } from "@/lib/compare/insights";
import { logger } from "@/lib/observability/logger";

/**
 * Slugs to prerender at production build time: every record page plus the curated
 * vs pages. A deploy empties the ISR cache, and the 9 Nov 2026 crawls timed out on
 * exactly these sitemap URLs while ~1,000 pages each rendered on demand against
 * Supabase. Prebuilding serves them statically from the first request; the daily
 * `revalidate` on the routes then refreshes them in the background (stale-while-
 * revalidate), so a full crawl never triggers a render stampede.
 *
 * Preview and CI builds return [] — no build-time DB dependency there — and every
 * slug not listed here still renders on demand (dynamicParams defaults to true).
 */
export async function compareStaticParams(type: PublicEntityType): Promise<Array<{ slug: string }>> {
  if (process.env.VERCEL_ENV !== "production") return [];
  try {
    const entities = await getPublicEntities(type);
    const pairs = type === "guru" ? [] : pairsForType(type, entities);
    return [
      ...entities.map((e) => ({ slug: e.slug })),
      ...pairs.map(([a, b]) => ({ slug: vsPath(type, a.slug, b.slug).split("/").pop()! })),
    ];
  } catch (error) {
    // The build must not fail on a DB hiccup; the pages fall back to on-demand rendering.
    logger.error("compareStaticParams failed; record pages fall back to on-demand rendering.", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
