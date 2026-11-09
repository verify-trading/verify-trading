import type { Metadata } from "next";

import { getPublicEntity, type PublicEntityType } from "@/lib/compare/entities";
import { entityPath, isSeoWorthy } from "@/lib/compare/insights";
import { entityDescription } from "@/components/marketing/entity-detail";
import { pageMetadata } from "@/lib/marketing/seo";
import { getAppName } from "@/lib/site-config";

/** Search engines truncate titles past ~60 characters (the " | app" suffix counts too). */
const TITLE_LIMIT = 60;

/**
 * The entity name always stays in the title — it is what makes each page's title unique —
 * so only the descriptive tail is shortened when a long name would push the full
 * <title> past the display limit.
 */
export function entityTitle(entity: { type: string; name: string }): string {
  const [long, short] =
    entity.type === "guru"
      ? [`Is ${entity.name} legit? Trader and educator record`, `Is ${entity.name} legit? Trader record`]
      : [`Is ${entity.name} safe? Regulation and verdict`, `Is ${entity.name} safe? Verdict`];
  return `${long} | ${getAppName()}`.length <= TITLE_LIMIT ? long : short;
}

/** Metadata for an entity page. Thin records stay reachable and canonical but are kept out of the index. */
export async function entityMetadata(type: PublicEntityType, slug: string): Promise<Metadata> {
  const entity = await getPublicEntity(type, slug);
  if (!entity) return { title: "Not found", robots: { index: false } };
  const meta = pageMetadata({ title: entityTitle(entity), description: entityDescription(entity), path: entityPath(entity) });
  return isSeoWorthy(entity) ? meta : { ...meta, robots: { index: false, follow: true } };
}
