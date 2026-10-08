import { BlogClient, readingTimeMinutes as htmlReadingMinutes, type BlogArticle } from "babylovegrowth-next-js-blog";

import { BLOG_CATEGORIES, type BlogCard, type BlogCategory } from "./categories";
import { getPost, POSTS, readingTimeMinutes } from "./posts";

export { BLOG_CATEGORIES, type BlogCard, type BlogCategory };

/**
 * One blog feed: hand-written posts (posts.ts) plus BabyLoveGrowth articles (when
 * BABYLOVEGROWTH_BLOG_API_KEY is set). Remote failures never break /blog — the feed
 * falls back to local posts only.
 */

const DEFAULT_CATEGORY: BlogCategory = "Markets and news";

// BabyLoveGrowth has keywords, not categories. First match wins, so order matters.
const CATEGORY_RULES: Array<[BlogCategory, RegExp]> = [
  ["Prop firms", /\bprop\b|prop firm|funded|challenge|evaluation|payout/i],
  ["Broker safety", /broker|regulat|\bfca\b|scam|licen[cs]e|withdraw/i],
  ["Risk management", /risk|position siz|lot size|drawdown|stop loss|leverage|margin/i],
  ["Trading psychology", /psycholog|discipline|emotion|tilt|revenge|mindset|fomo/i],
];

export function categorize(text: string): BlogCategory {
  return CATEGORY_RULES.find(([, re]) => re.test(text))?.[0] ?? DEFAULT_CATEGORY;
}

export function asCategory(value: string): BlogCategory {
  return (BLOG_CATEGORIES as readonly string[]).includes(value) ? (value as BlogCategory) : categorize(value);
}

const apiKey = process.env.BABYLOVEGROWTH_BLOG_API_KEY;
const remote = apiKey
  ? new BlogClient({
      apiKey,
      baseUrl: process.env.BABYLOVEGROWTH_BLOG_API_URL,
      revalidate: process.env.NODE_ENV === "development" ? 60 : 3600,
    })
  : null;

async function remoteSummaries() {
  if (!remote) return [];
  try {
    return await remote.getAllArticles();
  } catch (error) {
    console.error("[blog] BabyLoveGrowth list failed", error);
    return [];
  }
}

export async function getBlogCards(): Promise<BlogCard[]> {
  const local: BlogCard[] = POSTS.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.description,
    category: asCategory(p.category),
    date: p.date,
    readMins: readingTimeMinutes(p),
  }));

  const remoteCards: BlogCard[] = (await remoteSummaries())
    .filter((a) => !getPost(a.slug))
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt || a.meta_description,
      category: categorize([a.title, a.seedKeyword ?? "", ...a.keywords].join(" ")),
      date: a.published_at,
      readMins: null,
    }));

  return [...local, ...remoteCards].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export type RemoteArticle = BlogArticle & { category: BlogCategory; readMins: number; html: string };

export async function getRemoteArticle(slug: string): Promise<RemoteArticle | null> {
  if (!remote) return null;
  try {
    const a = await remote.getArticleBySlug(slug);
    if (!a || !a.published) return null;
    return {
      ...a,
      category: categorize([a.title, a.seedKeyword ?? "", ...a.keywords].join(" ")),
      readMins: htmlReadingMinutes(a.content_html),
      html: cleanArticleHtml(a.content_html, a.hero_image_url),
    };
  } catch (error) {
    console.error("[blog] BabyLoveGrowth article failed", slug, error);
    return null;
  }
}

export async function getRemoteSitemapEntries() {
  if (!remote) return [];
  try {
    return (await remote.getSitemapEntries()).filter((e) => !getPost(e.slug));
  } catch {
    return [];
  }
}

/**
 * Vendor HTML is rendered as-is (as BabyLoveGrowth's own starter does), minus scripts and inline handlers.
 * ponytail: regex strip, not a full sanitizer; add sanitize-html if the content source ever becomes untrusted.
 */
export function stripActiveContent(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/**
 * Fit BabyLoveGrowth HTML into our article shell: drop the leading <h1> (the page renders the title),
 * the cover <img> when it repeats hero_image_url (the page renders the cover), and their inline-styled
 * CTA blocks (light theme; every article page ends with our own CTA band) and their footer credit.
 */
export function cleanArticleHtml(html: string, heroUrl?: string | null): string {
  let out = stripActiveContent(html).replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
  if (heroUrl) {
    out = out.replace(/<p>\s*<img\b[^>]*>\s*<\/p>/i, (m) => (m.includes(heroUrl) ? "" : m));
  }
  // Their footer credit link ("Created with BabyLoveGrowth technology").
  out = out.replace(/<p>\s*<a\b[^>]*babylovegrowth\.ai[^>]*>[^<]*<\/a>\s*<\/p>/gi, "");
  return removeDivBlocks(out, "data-blg-cta").trim();
}

/** Remove every <div …attr…> block, matching nested divs by depth (regex alone can't). */
function removeDivBlocks(html: string, attr: string): string {
  const open = new RegExp(`<div\\b[^>]*\\b${attr}\\b`, "i");
  let out = html;
  for (let start = out.search(open); start !== -1; start = out.search(open)) {
    const tag = /<\/?div\b[^>]*>/gi;
    tag.lastIndex = start;
    let depth = 0;
    let end = -1;
    for (let m = tag.exec(out); m; m = tag.exec(out)) {
      depth += m[0][1] === "/" ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    if (end === -1) break; // unbalanced markup: leave it rather than eat the article
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

