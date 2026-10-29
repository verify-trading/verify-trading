import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Breadcrumbs, Byline, CtaBand } from "@/components/marketing/primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { GLOSSARY, GLOSSARY_REVIEWED, getTerm } from "@/lib/marketing/glossary";
import { definedTermSchema, pageMetadata } from "@/lib/marketing/seo";
import { POSTS } from "@/lib/blog/posts";

type Props = { params: Promise<{ term: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTerm((await params).term);
  if (!t) return {};
  return pageMetadata({
    title: `What is ${t.term}? Definition & Example`,
    description: t.short.length > 160 ? `${t.short.slice(0, 157)}...` : t.short,
    path: `/glossary/${t.slug}`,
  });
}

export default async function GlossaryTermPage({ params }: Props) {
  const t = getTerm((await params).term);
  if (!t) notFound();
  const path = `/glossary/${t.slug}`;
  const posts = POSTS.filter((p) => p.terms?.includes(t.slug)).slice(0, 2);

  return (
    <>
      <JsonLd data={definedTermSchema({ term: t.term, slug: t.slug, description: t.short })} />
      <Breadcrumbs crumbs={[{ name: "Glossary", path: "/glossary" }, { name: t.term, path }]} />
      <article className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]">{t.category}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.6rem] lg:leading-[1.1]">
          What is {t.term}?
        </h1>
        <div className="mt-4 border-b border-white/[0.08] pb-5">
          <Byline updated={GLOSSARY_REVIEWED} />
        </div>

        {/* Definition in an editorial text callout */}
        <div className="mt-8 border-l-2 border-[var(--vt-coral)] pl-5 py-1 text-[17px] font-medium leading-8 text-slate-100">
          {t.short}
        </div>

        {/* Key points */}
        <section aria-labelledby="key-points" className="mt-8 border-t border-white/10 pt-6">
          <h2 id="key-points" className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--vt-coral)]">Key points</h2>
          <ul className="mt-4 space-y-2.5">
            {t.points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] leading-7 text-slate-300">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--vt-coral)]" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Detailed explanation */}
        <div className="mt-10 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-white">{t.term} explained</h2>
          {t.body.map((para) => (
            <p key={para} className="text-[17px] leading-8 text-slate-300">
              {para}
            </p>
          ))}
        </div>

        {t.example ? (
          <div className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--vt-coral)]">Example</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-300">
              {t.example}
            </p>
          </div>
        ) : null}

        {/* Related terms as small chips */}
        <div className="mt-12 border-t border-white/[0.08] pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-muted)]">Related terms</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {t.related.map((slug) => {
              const rel = getTerm(slug);
              if (!rel) return null;
              return (
                <li key={slug}>
                  <Link
                    href={`/glossary/${slug}`}
                    className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {rel.term}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Related guides or tools if any */}
        {(t.links.length > 0 || posts.length > 0) ? (
          <div className="mt-8 border-t border-white/[0.08] pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--vt-muted)]">Related tools and guides</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {t.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {l.label} <ArrowRight className="size-3 text-[var(--vt-blue)]" aria-hidden />
                  </Link>
                </li>
              ))}
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {p.title} <ArrowRight className="size-3 text-[var(--vt-blue)]" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-10 text-xs leading-relaxed text-[var(--vt-muted)]">
          General education, not investment advice. Regulatory limits and prop firm rules change; check the official source. {NOT_ADVICE_STATEMENT}
        </p>
      </article>

      <CtaBand
        title="Check a name before you deposit"
        body="Free checks against regulator records, with the source shown."
        primary={{ label: "Check a name", href: "/ask", event: "ask" }}
        secondary={{ label: "All terms", href: "/glossary" }}
        location="glossary_term"
      />
    </>
  );
}
