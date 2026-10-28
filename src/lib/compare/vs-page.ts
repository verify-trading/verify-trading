import type { PublicEntity, PublicEntityType } from "@/lib/compare/entities";
import { getPublicEntities } from "@/lib/compare/entities";
import { isIndexedVsPair, pairKey, parseVsPair, vsPath } from "@/lib/compare/insights";

export type VsResolution =
  | { kind: "notFound" }
  | { kind: "redirect"; to: string }
  | { kind: "ok"; a: PublicEntity; b: PublicEntity; canonical: string; indexed: boolean };

/**
 * Resolve a "<a>-vs-<b>" segment for a register type into a renderable pair.
 * - malformed / self-pair / unknown slug → notFound (404)
 * - non-canonical ordering (a > b) → redirect to the sorted URL (no duplicate content)
 * - both resolve → ok, with `indexed` true only for the curated high-intent set
 */
export async function resolveVsPage(type: PublicEntityType, segment: string): Promise<VsResolution> {
  const parsed = parseVsPair(segment);
  if (!parsed) return { kind: "notFound" };
  const [reqA, reqB] = parsed;

  const [x, y] = pairKey(reqA, reqB);
  // Only the canonical (alphabetical) ordering is a real page; anything else redirects to it.
  if (reqA !== x || reqB !== y) return { kind: "redirect", to: vsPath(type, x, y) };

  const entities = await getPublicEntities(type);
  const a = entities.find((e) => e.slug === x) ?? null;
  const b = entities.find((e) => e.slug === y) ?? null;
  if (!a || !b || a.slug === b.slug) return { kind: "notFound" };

  return { kind: "ok", a, b, canonical: vsPath(type, x, y), indexed: isIndexedVsPair(type, entities, x, y) };
}
