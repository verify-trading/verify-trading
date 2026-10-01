import type { Metadata } from "next";

import type { SchemaOrgObject } from "@/lib/seo/schema";
import { getAppName, getSiteUrl } from "@/lib/site-config";

/**
 * Per-page metadata for the marketing routes. The root layout only sets site-wide
 * OG fields, and Next replaces (not merges) `openGraph`, so each page states its own
 * title/description/url here. og:image comes from src/app/opengraph-image.tsx.
 */
export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
}): Metadata {
  const { title, description, path, type = "website", publishedTime } = input;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: getAppName(),
      title: `${title} | ${getAppName()}`,
      description,
      url: path,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: `${title} | ${getAppName()}`, description },
  };
}

const abs = (path: string) => `${getSiteUrl()}${path}`;

export type Crumb = { name: string; path: string };

export function breadcrumbSchema(crumbs: Crumb[]): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: abs(crumb.path),
    })),
  };
}

export function webPageSchema(input: { name: string; description: string; path: string }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url: abs(input.path),
    isPartOf: { "@type": "WebSite", name: getAppName(), url: getSiteUrl() },
  };
}

/** Free products only: `offers.price` 0 must be literally true. No ratings (none exist). */
export function freeSoftwareSchema(input: { name: string; description: string; path: string }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    description: input.description,
    url: abs(input.path),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  };
}

export function itemListSchema(input: {
  name: string;
  items: Array<{ name: string; path: string }>;
}): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.name,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: abs(item.path),
    })),
  };
}

export function articleSchema(input: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    mainEntityOfPage: abs(input.path),
    url: abs(input.path),
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@type": "Organization", name: getAppName(), url: getSiteUrl() },
    publisher: { "@type": "Organization", name: getAppName(), url: getSiteUrl() },
  };
}

export const GLOSSARY_PATH = "/glossary";

export function definedTermSetSchema(input: { terms: Array<{ term: string; slug: string }> }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": abs(GLOSSARY_PATH),
    name: `${getAppName()} trading glossary`,
    url: abs(GLOSSARY_PATH),
    hasDefinedTerm: input.terms.map((t) => ({ "@type": "DefinedTerm", name: t.term, url: abs(`${GLOSSARY_PATH}/${t.slug}`) })),
  };
}

export function definedTermSchema(input: { term: string; slug: string; description: string }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: input.term,
    description: input.description,
    url: abs(`${GLOSSARY_PATH}/${input.slug}`),
    inDefinedTermSet: abs(GLOSSARY_PATH),
  };
}

/** Free in-browser calculator. `offers.price` 0 is literally true; no ratings. */
export function toolSchema(input: { name: string; description: string; path: string }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: abs(input.path),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any (runs in the browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  };
}

export function collectionPageSchema(input: { name: string; description: string; path: string }): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: abs(input.path),
    isPartOf: { "@type": "WebSite", name: getAppName(), url: getSiteUrl() },
  };
}
