import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/compare/sitemap", () => ({ getCompareSitemapEntries: async () => [] }));
vi.mock("@/lib/blog/feed", () => ({ getRemoteSitemapEntries: async () => [] }));

import sitemap from "@/app/sitemap";
import { GLOSSARY } from "@/lib/marketing/glossary";

describe("sitemap", () => {
  it("lists each URL once", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out noindex and thin auth pages", async () => {
    const paths = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(paths).not.toContain("/signup");
    expect(paths).toContain("/contact");
  });

  it("lists the glossary hub and every glossary term", async () => {
    const paths = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(paths).toContain("/glossary");
    for (const t of GLOSSARY) expect(paths).toContain(`/glossary/${t.slug}`);
  });

  it("never stamps the request time as lastmod", async () => {
    const before = Date.now() - 60_000;
    for (const e of await sitemap()) {
      if (e.lastModified) expect(new Date(e.lastModified).getTime()).toBeLessThan(before);
    }
  });
});

import { REVIEWED as FUTURES_REVIEWED } from "@/app/(marketing)/compare/futures-prop-firms/page";

describe("compare page review dates", () => {
  it("drive the sitemap lastmod for that page", async () => {
    const entries = await sitemap();
    const futures = entries.find((e) => e.url.endsWith("/compare/futures-prop-firms"));
    expect(futures?.lastModified).toEqual(new Date(FUTURES_REVIEWED));
  });

  it("are real ISO dates in the past or today", () => {
    const now = Date.now();
    for (const d of [FUTURES_REVIEWED]) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true);
      const t = Date.parse(d);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeLessThanOrEqual(now);
    }
  });
});
