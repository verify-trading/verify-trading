import { describe, expect, it } from "vitest";

import { POSTS, readingTimeMinutes } from "@/lib/blog/posts";
import { PRICING_FAQS } from "@/lib/marketing/copy";
import { allMarketingFaqs } from "@/lib/marketing/faqs";
import { GLOSSARY, getTerm } from "@/lib/marketing/glossary";
import { LINKS, postCard, termCard } from "@/lib/marketing/links";

const words = (post: (typeof POSTS)[number]) =>
  post.body.flatMap((b) => (b.type === "ul" || b.type === "ol" ? b.items : [b.text])).join(" ").split(/\s+/).filter(Boolean).length;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("blog registry", () => {
  it("has 8-12 posts with unique slugs", () => {
    expect(POSTS.length).toBeGreaterThanOrEqual(8);
    expect(POSTS.length).toBeLessThanOrEqual(12);
    expect(new Set(POSTS.map((p) => p.slug)).size).toBe(POSTS.length);
  });
  it("has descriptions sized for meta tags and real article length", () => {
    for (const p of POSTS) {
      expect(p.description.length, p.slug).toBeGreaterThan(90);
      expect(p.description.length, p.slug).toBeLessThan(200);
      expect(words(p), p.slug).toBeGreaterThan(650);
      expect(readingTimeMinutes(p)).toBeGreaterThan(2);
    }
  });
  it("only references posts and terms that exist", () => {
    for (const p of POSTS) {
      for (const s of p.relatedPosts ?? []) expect(() => postCard(s), `${p.slug} -> ${s}`).not.toThrow();
      for (const t of p.terms ?? []) expect(getTerm(t), `${p.slug} -> ${t}`).toBeDefined();
      for (const r of p.related) {
        if (r.href.startsWith("/glossary/")) expect(getTerm(r.href.split("/")[2]), r.href).toBeDefined();
      }
    }
  });
});

describe("glossary registry", () => {
  it("has unique slugs and terms", () => {
    expect(new Set(GLOSSARY.map((t) => t.slug)).size).toBe(GLOSSARY.length);
    expect(new Set(GLOSSARY.map((t) => norm(t.term))).size).toBe(GLOSSARY.length);
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
  });
  it("resolves every related term and blog link", () => {
    const slugs = new Set(POSTS.map((p) => p.slug));
    for (const t of GLOSSARY) {
      expect(t.short.length, t.slug).toBeGreaterThan(40);
      expect(t.related.length, t.slug).toBeGreaterThanOrEqual(2);
      for (const r of t.related) expect(() => termCard(r), `${t.slug} -> ${r}`).not.toThrow();
      for (const l of t.links) {
        if (l.href.startsWith("/blog/")) expect(slugs.has(l.href.split("/")[2]), `${t.slug} -> ${l.href}`).toBe(true);
        if (l.href.startsWith("/glossary/")) expect(getTerm(l.href.split("/")[2])).toBeDefined();
      }
    }
  });
});

describe("FAQ registry", () => {
  it("never repeats a question across pages or pricing", () => {
    const ours = allMarketingFaqs().map((f) => norm(f.q));
    expect(ours.filter((q, i) => ours.indexOf(q) !== i)).toEqual([]);
    const theirs = new Set(PRICING_FAQS.map((f) => norm(f.q)));
    expect(ours.filter((q) => theirs.has(q))).toEqual([]);
  });
  it("has substantive answers", () => {
    for (const f of allMarketingFaqs()) {
      expect(f.q.endsWith("?"), f.q).toBe(true);
      expect(f.a.length, f.q).toBeGreaterThan(60);
    }
  });
});

describe("link registry", () => {
  it("uses unique internal hrefs", () => {
    const hrefs = Object.values(LINKS).map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) expect(h.startsWith("/")).toBe(true);
  });
});
