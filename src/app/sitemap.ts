import type { MetadataRoute } from "next";

import { POSTS } from "@/lib/blog/posts";
import { getCompareSitemapEntries } from "@/lib/compare/sitemap";
import { GLOSSARY } from "@/lib/marketing/glossary";
import { getSiteUrl } from "@/lib/site-config";

const MARKETING_PATHS: Array<[path: string, priority: number]> = [
  ["/how-it-works", 0.8],
  ["/verify", 0.8],
  ["/intelligence", 0.7],
  ["/economic-calendar", 0.7],
  ["/journal", 0.7],
  ["/mind", 0.7],
  ["/compare/brokers", 0.8],
  ["/compare/prop-firms", 0.8],
  ["/retail-traders", 0.7],
  ["/prop-firm-traders", 0.7],
  ["/brokers", 0.5],
  ["/prop-firms", 0.5],
  ["/blog", 0.7],
  ["/glossary", 0.7],
  ["/resources", 0.7],
  ["/faq", 0.6],
  ["/trust", 0.6],
  ["/tools/position-size-calculator", 0.8],
  ["/tools/risk-reward-calculator", 0.7],
  ["/tools/pip-value-calculator", 0.7],
  ["/tools/margin-calculator", 0.7],
  ["/about", 0.5],
  ["/careers", 0.3],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();

  // Compare/regulator/entity/vs URLs come from the compare module. A failed DB read omits them rather than breaking the sitemap.
  const compareEntries = await getCompareSitemapEntries(baseUrl).catch(() => []);
  const dynamicEntries: MetadataRoute.Sitemap = [
    ...MARKETING_PATHS.map(([path, priority]) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...POSTS.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    ...GLOSSARY.map((t) => ({
      url: `${baseUrl}/glossary/${t.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
    ...compareEntries,
  ];

  return [
    ...dynamicEntries,
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/affiliates`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/risk-disclosure`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
