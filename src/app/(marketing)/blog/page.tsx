import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumbs, CtaBand, PageHero, Section } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { POSTS, readingTimeMinutes } from "@/lib/blog/posts";
import { itemListSchema, pageMetadata } from "@/lib/marketing/seo";

const path = "/blog";
export const metadata: Metadata = pageMetadata({
  title: "Trading Blog: Broker Safety, Prop Firm Rules & Risk",
  description:
    "Plain-English guides on checking brokers, understanding prop firm rules, position sizing, drawdown and trading psychology. Written to inform, never to sell a broker or a signal.",
  path,
});

export default function BlogIndexPage() {
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Blog", path }]} />
      <JsonLd data={itemListSchema({ name: "verify.trading blog", items: posts.map((p) => ({ name: p.title, path: `${path}/${p.slug}` })) })} />
      <PageHero
        eyebrow="Blog"
        title="Guides for traders who verify first"
        lede="Plain-English explainers on broker safety, prop firm rules, risk, psychology and news. General education only, never advice, and never paid for by the firms we write about."
        location="blog"
      />

      <Section eyebrow="Articles" title="All guides and investigations" narrow>
        <ul className="divide-y divide-white/10 border-y border-white/10">
          {posts.map((p) => (
            <li key={p.slug} className="py-6 sm:py-8 first:pt-4 last:pb-4">
              <article>
                <p className="font-mono text-xs uppercase tracking-wider text-[var(--vt-coral)]">
                  {p.category} <span className="text-slate-500">·</span>{" "}
                  <span className="font-sans text-slate-400 lowercase">{readingTimeMinutes(p)} min read</span>
                </p>
                <h3 className="mt-2 text-xl font-semibold leading-snug text-white">
                  <Link href={`${path}/${p.slug}`} className="transition-colors hover:text-[var(--vt-coral)]">
                    {p.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-2 text-[15px] leading-7 text-slate-400">
                  {p.description}
                </p>
                <div className="mt-3">
                  <Link
                    href={`${path}/${p.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    Read guide <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Section>

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
