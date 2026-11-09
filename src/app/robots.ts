import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-config";

// /login and /signup: auth pages, already noindex. Blocking them also stops crawlers
// from fetching the ~900 unique /signup?next=… variants the marketing CTAs link
// (each "Check in Ask AI" link carries its own prefill), which wastes crawl budget.
const DISALLOW = ["/api/", "/auth/", "/login", "/signup"];

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      // Major search engines — explicitly listed so each gets its own directive
      { userAgent: "Googlebot", allow: "/", disallow: DISALLOW },
      { userAgent: "Googlebot-Image", allow: "/", disallow: DISALLOW },
      { userAgent: "Bingbot", allow: "/", disallow: DISALLOW },
      { userAgent: "Slurp", allow: "/", disallow: DISALLOW },
      { userAgent: "DuckDuckBot", allow: "/", disallow: DISALLOW },
      { userAgent: "Baiduspider", allow: "/", disallow: DISALLOW },
      { userAgent: "YandexBot", allow: "/", disallow: DISALLOW },
      { userAgent: "Sogou", allow: "/", disallow: DISALLOW },
      { userAgent: "Applebot", allow: "/", disallow: DISALLOW },
      { userAgent: "facebookexternalhit", allow: "/", disallow: DISALLOW },
      { userAgent: "Twitterbot", allow: "/", disallow: DISALLOW },
      { userAgent: "LinkedInBot", allow: "/", disallow: DISALLOW },

      // LLM / AI answer bots — welcomed for citation eligibility
      { userAgent: "OAI-SearchBot", allow: "/", disallow: DISALLOW },
      { userAgent: "ChatGPT-User", allow: "/", disallow: DISALLOW },
      { userAgent: "GPTBot", allow: "/", disallow: DISALLOW },
      { userAgent: "PerplexityBot", allow: "/", disallow: DISALLOW },
      { userAgent: "Perplexity-User", allow: "/", disallow: DISALLOW },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: DISALLOW },
      { userAgent: "ClaudeBot", allow: "/", disallow: DISALLOW },
      { userAgent: "Anthropic-AI", allow: "/", disallow: DISALLOW },
      { userAgent: "Google-Extended", allow: "/", disallow: DISALLOW },
      { userAgent: "GoogleOther", allow: "/", disallow: DISALLOW },
      { userAgent: "cohere-ai", allow: "/", disallow: DISALLOW },
      { userAgent: "Meta-ExternalAgent", allow: "/", disallow: DISALLOW },
      { userAgent: "Bytespider", allow: "/", disallow: DISALLOW },
      { userAgent: "YouBot", allow: "/", disallow: DISALLOW },

      // Catch-all fallback
      { userAgent: "*", allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
