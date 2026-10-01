import type { Metadata } from "next";

import { getPublicEntity, type PublicEntityType } from "@/lib/compare/entities";
import { entityPath, isIndexable } from "@/lib/compare/insights";
import { entityDescription } from "@/components/marketing/entity-detail";
import { pageMetadata } from "@/lib/marketing/seo";

/** Metadata for an entity page. Thin records stay reachable and canonical but are kept out of the index. */
export async function entityMetadata(type: PublicEntityType, slug: string): Promise<Metadata> {
  const entity = await getPublicEntity(type, slug);
  if (!entity) return { title: "Not found", robots: { index: false } };
  const meta = pageMetadata({
    title: `Is ${entity.name} safe? Regulation and verdict`,
    description: entityDescription(entity),
    path: entityPath(entity),
  });
  return isIndexable(entity) ? meta : { ...meta, robots: { index: false, follow: true } };
}
