import type { Metadata } from "next";

import { BlogGrid } from "@/components/marketing/blog-grid";
import { Breadcrumbs, CtaBand, PageHero } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { getBlogCards } from "@/lib/blog/feed";
import { itemListSchema, pageMetadata } from "@/lib/marketing/seo";

const path = "/blog";
export const metadata: Metadata = pageMetadata({
  title: "Trading Blog: Broker Safety, Prop Firm Rules & Risk",
  description:
    "Plain-English guides on checking brokers, understanding prop firm rules, position sizing, drawdown and trading psychology. Written to inform, never to sell a broker or a signal.",
  path,
});

// New BabyLoveGrowth articles appear within the hour.
export const revalidate = 3600;

export default async function BlogIndexPage() {
  const cards = await getBlogCards();

  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Blog", path }]} />
      <JsonLd data={itemListSchema({ name: "verify.trading blog", items: cards.map((c) => ({ name: c.title, path: `${path}/${c.slug}` })) })} />
      <PageHero
        eyebrow="Blog"
        title="Guides for traders who verify first"
        lede="Plain-English guides on broker safety, prop firm rules, risk and trading psychology. General education, never advice, and never paid for by the firms we write about."
        location="blog"
      />
      <BlogGrid cards={cards} />
      <CtaBand
        title="Check a name before you deposit"
        body="Run a free check against regulator records, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "Learning hub", href: "/resources" }}
        location="blog"
      />
    </>
  );
}
