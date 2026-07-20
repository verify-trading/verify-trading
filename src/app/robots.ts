import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/"],
      },
      {
        // AI answer/citation crawlers: explicitly welcomed so verify.trading
        // is eligible to be cited in ChatGPT, Perplexity, Claude, and Google AI answers.
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "PerplexityBot",
          "Perplexity-User",
          "Claude-SearchBot",
          "ClaudeBot",
          "Google-Extended",
        ],
        allow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
