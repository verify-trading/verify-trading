"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { CATEGORY_THEME, BlogThumb } from "@/components/marketing/blog-thumb";
import { BLOG_CATEGORIES, type BlogCard, type BlogCategory } from "@/lib/blog/categories";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Meta({ card }: { card: BlogCard }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
      <span className={cn("font-semibold", CATEGORY_THEME[card.category].chip)}>{card.category}</span>
      <span aria-hidden>·</span>
      <time dateTime={card.date}>{dateFmt.format(new Date(card.date))}</time>
      {card.readMins ? (
        <>
          <span aria-hidden>·</span>
          <span>{card.readMins} min read</span>
        </>
      ) : null}
    </p>
  );
}

const cardShell =
  "group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--vt-blue)]/40 hover:bg-white/[0.035] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] motion-reduce:hover:translate-y-0";

function FeaturedCard({ card }: { card: BlogCard }) {
  return (
    <Link href={`/blog/${card.slug}`} className={cn(cardShell, "grid md:grid-cols-[1.15fr_1fr]")}>
      <BlogThumb category={card.category} size="feature" className="aspect-[16/9] md:aspect-auto md:min-h-[320px]" />
      <div className="flex flex-col p-6 sm:p-8">
        <span className="w-fit rounded-full bg-[var(--vt-coral)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--vt-coral)]">Latest</span>
        <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-white transition-colors group-hover:text-[var(--vt-coral)] sm:text-[1.75rem]">
          {card.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-slate-400">{card.excerpt}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-6">
          <Meta card={card} />
          <span className="inline-flex items-center gap-1 text-sm font-medium text-white">
            Read article <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ card }: { card: BlogCard }) {
  return (
    <Link href={`/blog/${card.slug}`} className={cn(cardShell, "flex flex-col")}>
      <BlogThumb category={card.category} title={card.title} className="aspect-[16/9] md:aspect-auto md:h-52" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <Meta card={card} />
        <h3 className="mt-2.5 text-lg font-semibold leading-snug tracking-tight text-white transition-colors group-hover:text-[var(--vt-coral)]">
          {card.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{card.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-slate-300 transition-colors group-hover:text-white">
          Read article <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/** Blog index: category filter pills, featured (latest) article, 2-column card grid. */
export function BlogGrid({ cards }: { cards: BlogCard[] }) {
  const [filter, setFilter] = useState<BlogCategory | "All">("All");
  const shown = filter === "All" ? cards : cards.filter((c) => c.category === filter);
  const [featured, ...rest] = shown;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
      <div role="tablist" aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {(["All", ...BLOG_CATEGORIES] as const).map((c) => {
          const active = c === filter;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(c)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition",
                active
                  ? "border-white bg-white text-[var(--vt-navy)]"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white",
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      {featured ? (
        <div className="mt-8 space-y-5">
          <FeaturedCard card={featured} />
          {rest.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {rest.map((c) => (
                <ArticleCard key={c.slug} card={c} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          No articles in {filter} yet. New guides are added every week.
        </p>
      )}
    </div>
  );
}
