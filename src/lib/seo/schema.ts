/**
 * Typed builders for schema.org JSON-LD, rendered via `<JsonLd>`
 * (`src/components/seo/json-ld.tsx`). Keep these truthful: no fabricated
 * ratings, social links, or claims — only what the product actually is.
 */
import { getAppName, getSiteDescription, getSiteUrl, SOCIAL_URLS, STORE_URLS } from "@/lib/site-config";

/** Plain JSON-LD object accepted by the `<JsonLd>` renderer's `data` prop. */
export type SchemaOrgObject = Record<string, unknown>;

/**
 * Organization schema. Pulls real values only — social URLs are the ones
 * verified in site-config (placeholders marked "#" are dropped), email
 * matches the contact page, store URLs link the real app listings.
 */
export function organizationSchema(): SchemaOrgObject {
  const siteUrl = getSiteUrl();
  const name = getAppName();
  const sameAs: string[] = [
    ...Object.values(SOCIAL_URLS).filter((u) => u !== "#"),
    ...Object.values(STORE_URLS),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}#organization`,
    name,
    alternateName: ["Verify Trading", "verify.trading"],
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/icon-512.png`,
      contentUrl: `${siteUrl}/icon-512.png`,
      width: 512,
      height: 512,
      caption: `${name} logo`,
    },
    image: `${siteUrl}/opengraph-image`,
    description: getSiteDescription(),
    email: "ai@verify.trading",
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "ai@verify.trading",
        availableLanguage: ["English"],
        areaServed: "Worldwide",
      },
    ],
    knowsAbout: [
      "Broker verification",
      "Prop firm verification",
      "FCA register",
      "CySEC",
      "ASIC",
      "Trading risk",
      "Position sizing",
      "Trading psychology",
    ],
    sameAs,
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

export function faqPageSchema(faqs: Array<{ q: string; a: string }>): SchemaOrgObject {
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
