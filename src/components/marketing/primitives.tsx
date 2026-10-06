import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SectionEyebrow } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import { CtaLink, type CtaEvent } from "@/components/marketing/cta-link";
import { PRODUCT_LINKS } from "@/lib/marketing/copy";
import { breadcrumbSchema, type Crumb } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";
import { cn } from "@/lib/utils";

export type IconTheme = "blue" | "amber" | "coral" | "purple" | "green" | "cyan";

export type Cta = { label: string; href: string; event?: CtaEvent };

/* ─── Breadcrumbs (visible + JSON-LD) ─── */

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...crumbs];
  return (
    <>
      <JsonLd data={breadcrumbSchema(all)} />
      <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--vt-muted)]">
          {all.map((crumb, i) => (
            <li key={crumb.path} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3 opacity-60" aria-hidden /> : null}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-slate-300">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.path} className="transition hover:text-white">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/* ─── Hero ─── */

export function PageHero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  visual,
  location,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: string;
  primary?: Cta;
  secondary?: Cta;
  visual?: ReactNode;
  location: string;
  children?: ReactNode;
}) {
  const split = Boolean(visual);
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_60%_65%_at_50%_45%,rgba(76,110,245,0.17),transparent_70%),radial-gradient(ellipse_35%_40%_at_82%_40%,rgba(242,109,109,0.09),transparent_70%)]">
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-16 sm:pb-16",
          split ? "grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14" : "max-w-3xl text-center",
        )}
      >
        <div className={split ? "" : "mx-auto"}>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-[2.6rem] lg:text-5xl">
            {title}
          </h1>
          <p
            className={cn(
              "mt-4 text-[15px] leading-7 text-slate-300 sm:text-base sm:leading-relaxed",
              split ? "max-w-xl" : "mx-auto max-w-2xl",
            )}
          >
            {lede}
          </p>
          {primary || secondary ? (
            <div className={cn("mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto", !split && "sm:justify-center")}>
              {primary ? (
                <CtaLink href={primary.href} event={primary.event} location={`${location}_hero`}>
                  {primary.label}
                  <ArrowRight aria-hidden />
                </CtaLink>
              ) : null}
              {secondary ? (
                <CtaLink href={secondary.href} event={secondary.event} location={`${location}_hero_secondary`} variant="outline">
                  {secondary.label}
                </CtaLink>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>
        {visual ? <div className="min-w-0">{visual}</div> : null}
      </div>
    </section>
  );
}

/* ─── Sections ─── */

export function Section({
  eyebrow,
  title,
  intro,
  children,
  band = false,
  narrow = false,
  id,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
  band?: boolean;
  narrow?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-14 sm:py-20", band && "bg-[linear-gradient(180deg,transparent,rgba(5,7,30,0.5)_18%,rgba(5,7,30,0.5)_82%,transparent)]")}>
      <div className={cn("mx-auto w-full px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl")}>
        <div className="max-w-2xl">
          {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
          {intro ? <p className="mt-3 text-[15px] leading-7 text-slate-400">{intro}</p> : null}
        </div>
        {children ? <div className="mt-8 sm:mt-10">{children}</div> : null}
      </div>
    </section>
  );
}

export type CardItem = {
  title: string;
  body: string;
  icon?: LucideIcon;
  theme?: IconTheme;
  index?: string;
};

/** Feature grid: soft gradient cards (Mobbin: Origin / Slash), optional icon tile or coral index label. */
export function CardGrid({
  items,
  cols = 3,
  numbered = false,
}: {
  items: CardItem[];
  cols?: 2 | 3;
  numbered?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map((item, i) => {
        const label = item.index ?? (numbered ? String(i + 1).padStart(2, "0") : null);
        return (
          <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 transition hover:border-[var(--vt-blue)]/40 sm:p-6">
            {item.icon ? (
              <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[var(--vt-blue)]/15 text-[#8fa5ff]">
                <item.icon className="size-5" aria-hidden />
              </span>
            ) : null}
            {label ? (
              <span className="font-mono text-xs font-semibold tracking-widest text-[var(--vt-coral)]">
                {label}
              </span>
            ) : null}
            <h3
              className={cn(
                "text-lg font-semibold tracking-tight text-white",
                label ? "mt-3" : "",
              )}
            >
              {item.title}
            </h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">{item.body}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Apollo-style vertical numbered list with hairline dividers.
 * Large muted number on the left, title and body on the right. No boxes.
 */
export function Steps({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ol className="max-w-3xl divide-y divide-white/[0.08]">
      {items.map((step, i) => (
        <li key={step.title} className="flex gap-6 py-6 sm:gap-10 sm:py-8">
          <span className="shrink-0 font-mono text-3xl font-light tabular-nums text-[var(--vt-coral)]/60">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              {step.title}
            </h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Related products: card links in columns. */
export function RelatedLinks({ keys, title = "Related products" }: { keys: string[]; title?: string }) {
  const items = keys.map((k) => PRODUCT_LINKS[k]).filter(Boolean).slice(0, 3);
  return (
    <Section title={title} band>
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {items.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 transition hover:border-[var(--vt-blue)]/40 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-white transition-colors group-hover:text-[var(--vt-coral)]">
                  {p.name}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                  {p.tier}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-7 text-slate-400">{p.blurb}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-slate-300 transition-colors group-hover:text-white">
                Learn more <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Centred CTA in a glowing gradient card, matching the How It Works banner. */
export function CtaBand({
  title,
  body,
  primary,
  secondary,
  location,
}: {
  title: string;
  body: string;
  primary: Cta;
  secondary?: Cta;
  location: string;
}) {
  return (
    <section className="py-14 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-white/[0.12] bg-[linear-gradient(110deg,rgba(76,110,245,0.2),rgba(139,92,246,0.14)_55%,rgba(242,109,109,0.2))] px-6 py-10 text-center shadow-[0_0_60px_rgba(76,110,245,0.15)] sm:px-10 sm:py-14">
          <h2 className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-slate-300">{body}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center [&>*]:w-full sm:[&>*]:w-auto">
            <CtaLink href={primary.href} event={primary.event} location={`${location}_cta`}>
              {primary.label}
              <ArrowRight aria-hidden />
            </CtaLink>
            {secondary ? (
              <CtaLink href={secondary.href} event={secondary.event} location={`${location}_cta_secondary`} variant="outline">
                {secondary.label}
              </CtaLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Native <details> accordion: server-rendered, no client JS, answers stay in the HTML for crawlers. */
export function Faq({ items }: { items: Array<{ q: string; a: string }> }) {
  const visible = items.slice(0, 6);
  return (
    <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {visible.map((f) => (
        <details key={f.q} className="group py-1">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-left text-[15px] font-medium leading-snug text-white transition hover:text-slate-200 [&::-webkit-details-marker]:hidden">
            <span>{f.q}</span>
            <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90" aria-hidden />
          </summary>
          <div className="pb-4 pt-1 text-[15px] leading-7 text-slate-400">
            {f.a}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Small static phone frame around a mock screen. Sample data only. */
export function PhoneMock({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="mx-auto w-full max-w-[340px]">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 inset-y-8 -z-10 rounded-[3rem] bg-gradient-to-b from-[rgba(76,110,245,0.5)] via-[rgba(139,92,246,0.35)] to-[rgba(242,109,109,0.22)] blur-2xl"
        />
        <div className="flex h-[600px] flex-col overflow-hidden rounded-[2.5rem] border-[6px] border-[#1a1f4a] bg-[var(--vt-navy)] shadow-2xl">
          <div className="flex h-9 shrink-0 items-center justify-center" aria-hidden>
            <span className="h-1.5 w-16 rounded-full bg-white/15" />
          </div>
          {children}
        </div>
      </div>
      {caption ? <figcaption className="mt-4 text-center text-xs text-[var(--vt-muted)]">{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * FAQ section: title + CTA on the left, accordion on the right (Mobbin: Dovetail / Vizcom).
 * Emits FAQPage JSON-LD unless `schema={false}`. Each question's markup must live on ONE page only.
 */
export function FaqSection({
  items,
  title = "Questions, answered",
  intro,
  schema = true,
  band = true,
}: {
  items: Array<{ q: string; a: string }>;
  title?: string;
  intro?: string;
  schema?: boolean;
  band?: boolean;
}) {
  const visible = items.slice(0, 6);
  return (
    <section id="faq" className={cn("scroll-mt-20 py-14 sm:py-20", band && "bg-[linear-gradient(180deg,transparent,rgba(5,7,30,0.5)_18%,rgba(5,7,30,0.5)_82%,transparent)]")}>
      {schema ? <JsonLd data={faqPageSchema(visible)} /> : null}
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.4fr] lg:gap-14">
        <div>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
          {intro ? <p className="mt-3 text-[15px] leading-7 text-slate-400">{intro}</p> : null}
          <p className="mt-4 text-sm text-slate-400">
            Still stuck?{" "}
            <Link href="/contact" className="text-[var(--vt-blue)] hover:underline">Contact us</Link>.
          </p>
        </div>
        <Faq items={visible} />
      </div>
    </section>
  );
}

export type LinkCard = { href: string; title: string; body: string; tag?: string };

/** Generic related/spoke links grid: card links with arrow. */
export function LinkGrid({
  items,
  title,
  eyebrow = "Keep going",
  band = true,
  cols = 3,
}: {
  items: LinkCard[];
  title: string;
  eyebrow?: string;
  band?: boolean;
  cols?: 2 | 3;
}) {
  const shown = items.slice(0, cols === 2 ? 4 : 3);
  return (
    <Section eyebrow={eyebrow} title={title} band={band}>
      <ul
        className={cn(
          "grid gap-4 sm:gap-5",
          cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {shown.map((p) => (
          <li key={p.href}>
            <Link href={p.href} className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 transition hover:border-[var(--vt-blue)]/40 sm:p-6">
              {p.tag ? (
                <span className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--vt-coral)]/80">{p.tag}</span>
              ) : null}
              <span className="text-base font-semibold text-white transition-colors group-hover:text-[var(--vt-coral)]">
                {p.title}
              </span>
              <p className="mt-2 text-[15px] leading-7 text-slate-400">{p.body}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-slate-300 transition-colors group-hover:text-white">
                Read more <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Free vs Pro: clean two-column comparison with no card backgrounds.
 * Column headings with hairline under each, plain check lists below. Pro gets a coral heading.
 */
export function FreeVsPro({ free, pro, note }: { free: string[]; pro: readonly string[]; note?: string }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <div>
        <div className="border-b border-white/10 pb-3">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-slate-300">Free</h3>
        </div>
        <ul className="mt-5 space-y-3">
          {free.map((f) => (
            <li key={f} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <Check className="mt-0.5 size-4 shrink-0 text-[var(--vt-green)]" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="border-b border-white/10 pb-3">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--vt-coral)]">Pro</h3>
        </div>
        <ul className="mt-5 space-y-3">
          {pro.slice(0, 5).map((f) => (
            <li key={f} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <Check className="mt-0.5 size-4 shrink-0 text-[var(--vt-coral)]" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {note ? <p className="mt-5 text-xs leading-relaxed text-slate-400">{note}</p> : null}
        <div className="mt-4">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
          >
            See plans <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Sticky in-page table of contents (desktop sidebar; collapsible list on mobile). */
export function Toc({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-muted)]">On this page</p>
      <ol className="mt-3 space-y-2 border-l border-white/[0.08]">
        {items.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} className="-ml-px block border-l border-transparent pl-3 leading-snug text-slate-400 transition hover:border-[var(--vt-coral)] hover:text-white">
              {t.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Byline shown on articles, terms and tools. Links to /about; always shows a review date. */
export function Byline({ updated, extra }: { updated: string; extra?: string }) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <p className="text-xs leading-relaxed text-[var(--vt-muted)]">
      By <Link href="/about" className="text-slate-300 hover:underline">the verify.trading team</Link>
      {" · "}Last reviewed <time dateTime={updated}>{fmt.format(new Date(updated))}</time>
      {extra ? ` · ${extra}` : ""}
      {" · "}
      <Link href="/trust" className="hover:underline">How we write</Link>
    </p>
  );
}
