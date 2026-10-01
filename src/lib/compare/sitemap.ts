import type { MetadataRoute } from "next";

import { getPublicEntities } from "@/lib/compare/entities";
import { entityPath, hubIndexable, isIndexable, regulatorHubs, vsPairs } from "@/lib/compare/insights";

/** Every indexable data-driven URL: entity records, regulator hubs and the bounded set of vs pages. */
export async function getCompareSitemapEntries(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const [brokers, propFirms] = await Promise.all([getPublicEntities("broker"), getPublicEntities("propfirm")]);
  const url = (path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;
  const at = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso) : undefined);

  return [
    { url: url("/regulators"), changeFrequency: "weekly", priority: 0.7 },
    ...regulatorHubs(brokers)
      .filter(hubIndexable)
      .map((h) => ({ url: url(`/regulators/${h.regulator.slug}`), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...[...brokers, ...propFirms].filter(isIndexable).map((e) => ({
      url: url(entityPath(e)),
      lastModified: at(e.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...vsPairs(brokers).map(([a, b]) => ({
      url: url(`${entityPath(a)}/vs/${b.slug}`),
      lastModified: at(a.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
