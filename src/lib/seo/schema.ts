/**
 * Typed builders for schema.org JSON-LD, rendered via `<JsonLd>`
 * (`src/components/seo/json-ld.tsx`). Keep these truthful: no fabricated
 * ratings, social links, or claims — only what the product actually is.
 */
import type { FaqItem } from "@/lib/landing/faq";
import { getAppName, getSiteDescription, getSiteUrl } from "@/lib/site-config";

/** Plain JSON-LD object accepted by the `<JsonLd>` renderer's `data` prop. */
export type SchemaOrgObject = Record<string, unknown>;

/**
 * Organization schema. No verified social profile URLs exist in the
 * codebase (checked site-nav, site-footer) — `sameAs` is intentionally
 * omitted rather than fabricated.
 */
export function organizationSchema(): SchemaOrgObject {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: getAppName(),
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    description: getSiteDescription(),
  };
}

export function webSiteSchema(): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: getAppName(),
    url: getSiteUrl(),
  };
}

/**
 * `offers.price` is genuinely "0": entity checks are free. No
 * `aggregateRating` — there are no real reviews to report.
 */
export function softwareApplicationSchema(): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: getAppName(),
    description: getSiteDescription(),
    url: getSiteUrl(),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "GBP",
    },
  };
}

export function faqPageSchema(faqs: FaqItem[]): SchemaOrgObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}
