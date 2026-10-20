import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/compare/sitemap", () => ({ getCompareSitemapEntries: async () => [] }));
vi.mock("@/lib/blog/feed", () => ({ getRemoteSitemapEntries: async () => [] }));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("lists each URL once", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("leaves out noindex and thin auth pages", async () => {
    const paths = (await sitemap()).map((e) => new URL(e.url).pathname);
    expect(paths).not.toContain("/glossary");
    expect(paths).not.toContain("/signup");
    expect(paths).toContain("/contact");
  });

  it("never stamps the request time as lastmod", async () => {
    const before = Date.now() - 60_000;
    for (const e of await sitemap()) {
      if (e.lastModified) expect(new Date(e.lastModified).getTime()).toBeLessThan(before);
    }
  });
});
