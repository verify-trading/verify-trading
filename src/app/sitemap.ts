import type { MetadataRoute } from "next";

import { getRemoteSitemapEntries } from "@/lib/blog/feed";
import { POSTS } from "@/lib/blog/posts";
import { REVIEWED as FUTURES_REVIEWED } from "@/app/(marketing)/compare/futures-prop-firms/page";
import { REVIEWED as FOREX_REVIEWED } from "@/app/(marketing)/compare/forex-prop-firms/page";
import { REVIEWED as FOREX_VS_FUTURES_REVIEWED } from "@/app/(marketing)/compare/forex-vs-futures-prop-firms/page";
import { TOOLS_REVIEWED } from "@/components/marketing/tool-page";
import { getCompareSitemapEntries } from "@/lib/compare/sitemap";
import { getSiteUrl } from "@/lib/site-config";

/** Pages with a real review date get it as lastmod; the rest omit lastmod rather than claim "changed today" on every crawl. */

const MARKETING_PATHS: Array<[path: string, priority: number, reviewed?: string]> = [
  ["/how-it-works", 0.8],
  ["/verify", 0.8],
  ["/intelligence", 0.7],
  ["/economic-calendar", 0.7],
  ["/journal", 0.7],
  ["/mind", 0.7],
  ["/compare/brokers", 0.8],
  ["/compare/prop-firms", 0.8],
  ["/compare/futures-prop-firms", 0.8, FUTURES_REVIEWED],
  ["/compare/forex-prop-firms", 0.8, FOREX_REVIEWED],
  ["/compare/forex-vs-futures-prop-firms", 0.7, FOREX_VS_FUTURES_REVIEWED],
  ["/retail-traders", 0.7],
  ["/prop-firm-traders", 0.7],
  ["/brokers", 0.5],
  ["/prop-firms", 0.5],
  ["/blog", 0.7],
  // /glossary is noindex, so it stays out of the sitemap.
  ["/resources", 0.7],
  ["/faq", 0.6],
  ["/trust", 0.6],
  ["/tools/position-size-calculator", 0.8, TOOLS_REVIEWED],
  ["/tools/risk-reward-calculator", 0.7, TOOLS_REVIEWED],
  ["/tools/pip-value-calculator", 0.7, TOOLS_REVIEWED],
  ["/tools/margin-calculator", 0.7, TOOLS_REVIEWED],
  ["/tools/profit-loss-calculator", 0.7, TOOLS_REVIEWED],
  ["/tools/compound-growth-calculator", 0.7, TOOLS_REVIEWED],
  ["/about", 0.5],
  ["/careers", 0.3],
  ["/affiliates", 0.6],
];

const OTHER_PATHS: Array<[path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly"]> = [
  ["/", 1.0, "weekly"],
  ["/methodology", 0.8, "monthly"],
  ["/pricing", 0.8, "monthly"],
  ["/tools", 0.7, "weekly"],
  ["/contact", 0.4, "yearly"],
  ["/privacy", 0.3, "yearly"],
  ["/terms", 0.3, "yearly"],
  ["/cookies", 0.3, "yearly"],
  ["/risk-disclosure", 0.3, "yearly"],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const compareEntries = await getCompareSitemapEntries(baseUrl).catch(() => []);
  const remotePosts = await getRemoteSitemapEntries();

  return [
    ...MARKETING_PATHS.map(([path, priority, reviewed]) => ({
      url: `${baseUrl}${path}`,
      ...(reviewed ? { lastModified: new Date(reviewed) } : {}),
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...POSTS.map((p) => ({
      url: `${baseUrl}/blog/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    ...remotePosts.map((e) => ({
      url: `${baseUrl}/blog/${e.slug}`,
      lastModified: new Date(e.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...compareEntries,
    ...OTHER_PATHS.map(([path, priority, changeFrequency]) => ({
      url: path === "/" ? `${baseUrl}/` : `${baseUrl}${path}`,
      changeFrequency,
      priority,
    })),
  ];
}
