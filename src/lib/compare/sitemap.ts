import type { MetadataRoute } from "next";

import { getPublicEntities } from "@/lib/compare/entities";
import { entityPath, isSeoWorthy, listableEntities, pairsForType, regulatorHubs, vsPath } from "@/lib/compare/insights";

/** Every SEO-worthy data-driven URL: top entity records and major regulator hubs only. */
export async function getCompareSitemapEntries(baseUrl: string): Promise<MetadataRoute.Sitemap> {
  const [brokers, propFirms, gurus] = await Promise.all([
    getPublicEntities("broker"),
    getPublicEntities("propfirm"),
    getPublicEntities("guru"),
  ]);
  const url = (path: string) => `${baseUrl.replace(/\/$/, "")}${path}`;
  const at = (iso: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? new Date(iso) : undefined);

  return [
    { url: url("/regulators"), changeFrequency: "weekly", priority: 0.7 },
    ...regulatorHubs(listableEntities(brokers))
      .filter((h) => h.regulator.standing === "major" && h.entities.length >= 3)
      .map((h) => ({ url: url(`/regulators/${h.regulator.slug}`), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...[...brokers, ...propFirms, ...gurus].filter(isSeoWorthy).map((e) => ({
      url: url(entityPath(e)),
      lastModified: at(e.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Curated "X vs Y" comparison pages (canonical slug order only; the rest render noindex).
    ...[
      ...pairsForType("broker", brokers).map(([a, b]) => vsPath("broker", a.slug, b.slug)),
      ...pairsForType("propfirm", propFirms).map(([a, b]) => vsPath("propfirm", a.slug, b.slug)),
    ].map((path) => ({ url: url(path), changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
