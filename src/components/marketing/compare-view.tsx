import Link from "next/link";
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, SearchX, ShieldCheck, X, Search } from "lucide-react";

import { Breadcrumbs } from "@/components/marketing/primitives";
import { askCheckHref, EntityAvatar, formatRecordDate, ScoreBar, VerdictBadge } from "@/components/marketing/entity-ui";
import { FaqBlock, VerdictBands } from "@/components/marketing/entity-sections";
import { regulatorHubs } from "@/lib/compare/insights";
import { FilterMenu } from "@/components/marketing/filter-menu";
import { surface } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import {
  filterEntities,
  getPublicEntities,
  PAGE_SIZE,
  topRegulators,
  VERDICTS,
  type EntityFilters,
  type PublicEntity,
  type PublicEntityType,
} from "@/lib/compare/entities";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { itemListSchema } from "@/lib/marketing/seo";
import { cn } from "@/lib/utils";

const CONFIG = {
  broker: {
    path: "/compare/brokers",
    crumb: "Compare Brokers",
    plural: "brokers",
    h1: "Compare brokers",
    intro: "Independent verdicts for every broker in our register. Search by name, filter by verdict or regulator, and open a record for what each regulator means, how to verify the licence yourself and comparable brokers.",
  },
  propfirm: {
    path: "/compare/prop-firms",
    crumb: "Compare Prop Firms",
    plural: "prop firms",
    h1: "Compare prop firms",
    intro: "Independent verdicts for every prop firm in our register. Search by name, filter by verdict or status, and open a record for its score, status, how to verify the firm yourself and comparable firms.",
  },
} as const;

const LIST_FAQS: Record<PublicEntityType, Array<{ q: string; a: string }>> = {
  broker: [
    { q: "How do you decide a broker's verdict?", a: "From the regulator behind the broker, using a fixed rule-based model published in our methodology. A licence from a major regulator ranks above an offshore licence, and a broker with no licence ranks lowest. The same facts always produce the same verdict." },
    { q: "Can a broker pay to change its verdict?", a: "No. We take no affiliate commissions from brokers, and verdicts are computed from regulator records, not sold." },
    { q: "What does \"Awaiting a live register re-check\" mean?", a: "The record has not yet been re-confirmed against the regulator's live register. The verdict reflects the last confirmed information, so check the register yourself before you deposit." },
    { q: "Why do some brokers show no regulator?", a: "Our record lists none for them. That does not prove a firm is unlicensed, but we have no licence to point to. Those records are kept out of search engines until they hold more evidence." },
    { q: "How often are records updated?", a: "Pages refresh hourly from the register, and each record shows the date it was last updated." },
  ],
  propfirm: [
    { q: "How is a prop firm scored?", a: "The score is out of 10 and computed from the evidence we hold. Closed firms are rated Avoid. Firms we retain but have not scored show as Not yet rated, which is not a judgement either way." },
    { q: "Are prop firms regulated?", a: "Many prop firms sell evaluations on simulated accounts and are not regulated brokers. Read each firm's terms, and check who the legal entity behind the brand is." },
    { q: "Can a prop firm pay to change its verdict?", a: "No. We take no affiliate commissions from prop firms, and verdicts are computed from records, not sold." },
    { q: "How often are records updated?", a: "Pages refresh hourly from the register, and each record shows the date it was last updated." },
  ],
};

const SORTS = [
  { key: "name", label: "Name A-Z" },
  { key: "score", label: "Score, high to low" },
  { key: "updated", label: "Recently updated" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const STATUSES = [
  { key: "operating", label: "Operating" },
  { key: "developing", label: "Developing (not rated)" },
  { key: "closed", label: "Closed" },
] as const;

export type CompareSearchParams = Record<string, string | string[] | undefined>;
type View = EntityFilters & { sort: SortKey };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseCompareParams(sp: CompareSearchParams): EntityFilters {
  const page = Number.parseInt(first(sp.page) ?? "1", 10);
  return {
    q: first(sp.q)?.slice(0, 80),
    verdict: first(sp.verdict),
    regulator: first(sp.regulator),
    status: first(sp.status),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

const parseSort = (sp: CompareSearchParams): SortKey => {
  const s = first(sp.sort);
  return SORTS.some((o) => o.key === s) ? (s as SortKey) : "name";
};

/** Builds a shareable URL. `patch` overrides filters; page resets unless given. */
function hrefWith(path: string, v: View, patch: Partial<View> = {}) {
  const f = { ...v, page: 1, ...patch };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.verdict) params.set("verdict", f.verdict);
  if (f.regulator) params.set("regulator", f.regulator);
  if (f.status) params.set("status", f.status);
  if (f.sort !== "name") params.set("sort", f.sort);
  if ((f.page ?? 1) > 1) params.set("page", String(f.page));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function sortEntities(list: PublicEntity[], sort: SortKey): PublicEntity[] {
  if (sort === "name") return list;
  const out = [...list];
  if (sort === "score") out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
  else out.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.name.localeCompare(b.name));
  return out;
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pages: number): Array<number | "gap"> {
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return nums.flatMap((n, i) => (i > 0 && n - nums[i - 1] > 1 ? (["gap", n] as const) : [n]));
}

const chip =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60";
const chipOn = "border-[var(--vt-coral)]/50 bg-[var(--vt-coral)]/15 text-white";
const chipOff = "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white";

function RegulatorTags({ e }: { e: PublicEntity }) {
  if (e.type === "propfirm") {
    return (
      <span className="text-sm text-slate-400">
        {e.closed ? "Closed" : e.developing ? "Developing, not rated" : e.yearFounded ? `Founded ${e.yearFounded}` : "Operating"}
      </span>
    );
  }
  if (!e.regulators.length && !e.fcaWarning) return <span className="text-sm text-slate-500">No regulator listed</span>;
  const shown = e.regulators.slice(0, 3);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {e.fcaWarning ? (
        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--vt-coral)]/40 bg-[var(--vt-coral)]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--vt-coral)]">
          <AlertTriangle className="size-3" aria-hidden /> FCA warning
        </span>
      ) : null}
      {shown.map((r) => (
        <span
          key={r}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
            r === "FCA" && e.fcaRegistered
              ? "border-[var(--vt-green)]/35 bg-[var(--vt-green)]/10 text-[var(--vt-green)]"
              : "border-white/10 bg-white/[0.04] text-slate-300",
          )}
        >
          {r === "FCA" && e.fcaRegistered ? <ShieldCheck className="size-3" aria-hidden /> : null}
          {r}
        </span>
      ))}
      {e.regulators.length > shown.length ? <span className="text-[11px] text-slate-500">+{e.regulators.length - shown.length}</span> : null}
    </span>
  );
}

const COLS = "md:grid-cols-[minmax(0,1.7fr)_9.5rem_7.5rem_minmax(0,1.3fr)_6.5rem_8.5rem]";

export async function CompareView({ type, searchParams }: { type: PublicEntityType; searchParams: CompareSearchParams }) {
  const cfg = CONFIG[type];
  const filters = parseCompareParams(searchParams);
  const view: View = { ...filters, sort: parseSort(searchParams) };
  const all = await getPublicEntities(type);
  const matches = sortEntities(filterEntities(all, filters), view.sort);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pages);
  const rows = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const regulators = type === "broker" ? topRegulators(all) : [];
  const filtered = Boolean(filters.q || filters.verdict || filters.regulator || filters.status);
  const newest = all.map((e) => e.updatedAt).filter(Boolean).sort().at(-1) ?? null;
  const faqs = LIST_FAQS[type];
  const href = (patch: Partial<View> = {}) => hrefWith(cfg.path, view, patch);

  // Verdict chips carry counts for the other active filters, so a chip never leads to an empty list by surprise.
  const scoped = filterEntities(all, { ...filters, verdict: undefined });
  const verdicts = VERDICTS.filter((v) => type === "propfirm" || (v !== "High Risk" && v !== "Not yet rated"));
  const start = (page - 1) * PAGE_SIZE;
  const sortLabel = SORTS.find((s) => s.key === view.sort)?.label ?? "";
  const th = (label: string, key: SortKey | null, className?: string) =>
    key ? (
      <Link
        href={href({ sort: key })}
        scroll={false}
        aria-label={`Sort by ${label}`}
        className={cn("rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60", view.sort === key && "text-white", className)}
      >
        {label}
        {view.sort === key ? <span aria-hidden> ↓</span> : null}
      </Link>
    ) : (
      <span className={className}>{label}</span>
    );

  return (
    <>
      <Breadcrumbs crumbs={[{ name: cfg.crumb, path: cfg.path }]} />
      <JsonLd
        data={itemListSchema({
          name: `${cfg.crumb}: verification records`,
          items: rows.map((e) => ({ name: e.name, path: `${cfg.path}/${e.slug}` })),
        })}
      />

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6">
        <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{cfg.h1}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">{cfg.intro}</p>
          </div>
          <p className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
            <span className="font-semibold text-white">{all.length.toLocaleString("en-GB")} {cfg.plural}</span>
            <span aria-hidden>·</span>
            <span>Updated hourly</span>
            <span aria-hidden>·</span>
            <span>Independent, not for sale</span>
          </p>
        </header>

        <div className={cn(surface, "mt-5 p-3 sm:p-4")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <form method="get" action={cfg.path} role="search" className="relative min-w-0 flex-1">
              {view.verdict ? <input type="hidden" name="verdict" value={view.verdict} /> : null}
              {view.regulator ? <input type="hidden" name="regulator" value={view.regulator} /> : null}
              {view.status ? <input type="hidden" name="status" value={view.status} /> : null}
              {view.sort !== "name" ? <input type="hidden" name="sort" value={view.sort} /> : null}
              <label htmlFor="compare-q" className="sr-only">Search {cfg.plural} by name</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                id="compare-q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder={`Search ${all.length ? all.length.toLocaleString("en-GB") : ""} ${cfg.plural} by name`.replace("  ", " ")}
                maxLength={80}
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-20 text-sm text-white placeholder:text-slate-500 focus:border-[var(--vt-blue)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--vt-blue)]/30 [&::-webkit-search-cancel-button]:hidden"
              />
              <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {filters.q ? (
                  <Link href={href({ q: undefined })} aria-label="Clear search" className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60">
                    <X className="size-4" aria-hidden />
                  </Link>
                ) : null}
                <button type="submit" className="h-7 rounded-md bg-[var(--vt-coral)] px-2.5 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                  Search
                </button>
              </span>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              {type === "broker" ? (
                <FilterMenu
                  label="Regulator"
                  value={filters.regulator ?? "Any"}
                  active={Boolean(filters.regulator)}
                  options={[
                    { label: "Any regulator", href: href({ regulator: undefined }), active: !filters.regulator },
                    ...regulators.map((r) => ({ label: r, href: href({ regulator: r }), active: filters.regulator === r })),
                  ]}
                />
              ) : (
                <FilterMenu
                  label="Status"
                  value={STATUSES.find((s) => s.key === filters.status)?.label.split(" (")[0] ?? "Any"}
                  active={Boolean(filters.status)}
                  options={[
                    { label: "Any status", href: href({ status: undefined }), active: !filters.status },
                    ...STATUSES.map((s) => ({ label: s.label, href: href({ status: s.key }), active: filters.status === s.key })),
                  ]}
                />
              )}
              <FilterMenu
                label="Sort"
                value={sortLabel.split(",")[0]}
                align="right"
                options={SORTS.map((s) => ({ label: s.label, href: href({ sort: s.key }), active: view.sort === s.key }))}
              />
            </div>
          </div>

          <nav aria-label="Filter by verdict" className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            <Link href={href({ verdict: undefined })} scroll={false} aria-current={!filters.verdict ? "true" : undefined} className={cn(chip, !filters.verdict ? chipOn : chipOff)}>
              All <span className="text-slate-500">{scoped.length.toLocaleString("en-GB")}</span>
            </Link>
            {verdicts.map((v) => {
              const n = scoped.filter((e) => e.verdict === v).length;
              const on = filters.verdict === v;
              return (
                <Link key={v} href={href({ verdict: v })} scroll={false} aria-current={on ? "true" : undefined} className={cn(chip, on ? chipOn : chipOff, !on && n === 0 && "opacity-50")}>
                  {v} <span className="text-slate-500">{n.toLocaleString("en-GB")}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm" aria-live="polite">
          <p className="text-slate-400">
            {matches.length === 0
              ? `No ${cfg.plural} match`
              : `Showing ${start + 1}–${start + rows.length} of ${matches.length.toLocaleString("en-GB")} ${cfg.plural}`}
          </p>
          {filtered ? (
            <Link href={cfg.path} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--vt-blue)] hover:underline">
              <X className="size-3.5" aria-hidden /> Clear all filters
            </Link>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="mt-3">
            <div className={cn("sticky top-[57px] z-20 hidden gap-x-4 rounded-t-xl border border-white/[0.08] bg-[#0c1035] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:grid", COLS)} role="presentation">
              {th("Name", "name")}
              {th("Verdict", null)}
              {th("Score", "score")}
              {th(type === "broker" ? "Regulators" : "Status", null)}
              {th("Updated", "updated")}
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02] md:rounded-t-none md:border-t-0">
              {rows.map((e) => (
                <li key={e.slug} className={cn("group grid gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-white/[0.035] sm:px-5 md:items-center md:py-3", COLS)}>
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar name={e.name} verdict={e.verdict} />
                    <div className="min-w-0 flex-1">
                      <Link href={`${cfg.path}/${e.slug}`} className="block truncate rounded text-[15px] font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60">
                        {e.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--vt-muted)] md:hidden">Updated {formatRecordDate(e.updatedAt)}</p>
                    </div>
                    <VerdictBadge verdict={e.verdict} className="md:hidden" />
                  </div>
                  <div className="hidden md:block"><VerdictBadge verdict={e.verdict} /></div>
                  <ScoreBar entity={e} />
                  <RegulatorTags e={e} />
                  <p className="hidden text-xs text-slate-400 md:block">{formatRecordDate(e.updatedAt)}</p>
                  <div className="flex items-center gap-2 md:justify-end">
                    <Link href={`${cfg.path}/${e.slug}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-white/12 px-3 text-xs font-medium text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60 md:flex-none">
                      View record
                    </Link>
                    <Link href={askCheckHref(e.name)} prefetch={false} aria-label={`Run full check on ${e.name}`} title="Run full check" className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--vt-blue)] transition-colors hover:bg-[var(--vt-blue)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60 md:hidden">
                      Run full check <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={cn(surface, "mt-3 flex flex-col items-center px-6 py-14 text-center")}>
            <span className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400"><SearchX className="size-5" aria-hidden /></span>
            <h2 className="mt-4 text-base font-semibold text-white">No {cfg.plural} match{filters.q ? ` "${filters.q}"` : ""}</h2>
            <p className="mt-1.5 max-w-sm text-sm text-slate-400">
              Try a shorter name or fewer filters. If we may not hold a record yet, run a check in Ask.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {filtered ? (
                <Link href={cfg.path} className="inline-flex h-9 items-center rounded-lg bg-[var(--vt-coral)] px-4 text-sm font-semibold text-white hover:brightness-110">Clear filters</Link>
              ) : null}
              {filters.q ? (
                <Link href={askCheckHref(filters.q)} prefetch={false} className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/15 px-4 text-sm text-white hover:bg-white/5">
                  Run a check on &ldquo;{filters.q}&rdquo; <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <ul className="flex items-center gap-1">
              <li>
                {page > 1 ? (
                  <Link rel="prev" href={href({ page: page - 1 })} aria-label="Previous page" className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60"><ChevronLeft className="size-4" aria-hidden /></Link>
                ) : (
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-lg border border-white/[0.05] text-slate-600"><ChevronLeft className="size-4" /></span>
                )}
              </li>
              {pageWindow(page, pages).map((n, i) => (
                <li key={`${n}-${i}`} className={n !== "gap" && Math.abs(n - page) > 1 && n !== 1 && n !== pages ? "hidden sm:block" : undefined}>
                  {n === "gap" ? (
                    <span aria-hidden className="px-1 text-slate-600">…</span>
                  ) : (
                    <Link
                      href={href({ page: n })}
                      aria-label={`Page ${n}`}
                      aria-current={n === page ? "page" : undefined}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60",
                        n === page ? "border-[var(--vt-coral)]/50 bg-[var(--vt-coral)]/15 font-semibold text-white" : "border-white/10 text-slate-300 hover:bg-white/[0.07]",
                      )}
                    >
                      {n}
                    </Link>
                  )}
                </li>
              ))}
              <li>
                {page < pages ? (
                  <Link rel="next" href={href({ page: page + 1 })} aria-label="Next page" className="flex size-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60"><ChevronRight className="size-4" aria-hidden /></Link>
                ) : (
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-lg border border-white/[0.05] text-slate-600"><ChevronRight className="size-4" /></span>
                )}
              </li>
            </ul>
          </nav>
        ) : null}
      </section>

      <div className="border-t border-white/[0.06] bg-black/15">
        <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">How verdicts work</h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-400">
                <p>
                  {type === "broker"
                    ? "A broker's verdict starts from the strength of the regulator behind it: a licence from a major regulator ranks above an offshore one, and a firm with no licence ranks lowest. The same facts always give the same result."
                    : "A prop firm's verdict is a score out of 10 computed from the evidence we hold. Closed firms are rated Avoid, and firms we have not scored yet show as Not yet rated, which is not a judgement."}{" "}
                  Read <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">how we verify</Link> for the sources and limits.
                  {newest ? ` The most recent record update is dated ${formatRecordDate(newest)}.` : null}
                </p>
                <p>{INDEPENDENCE_STATEMENT}</p>
                <p>
                  A record can be out of date. Check the regulator&apos;s own register before you deposit, and{" "}
                  <Link href="/contact" className="text-[var(--vt-blue)] hover:underline">tell us</Link> if something is wrong.
                </p>
              </div>
            </div>
            <VerdictBands counts={Object.fromEntries(VERDICTS.map((v) => [v, all.filter((e) => e.verdict === v).length]))} propFirms={type === "propfirm"} />
          </div>

          {type === "broker" ? (
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">Browse by regulator</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">What each regulator protects, how to check its register, and every broker in our data that lists it.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {regulatorHubs(all).filter((h) => h.entities.length > 0).sort((a, b) => b.entities.length - a.entities.length).slice(0, 12).map((h) => (
                  <Link key={h.regulator.slug} href={`/regulators/${h.regulator.slug}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-white">
                    {h.regulator.code}
                    {h.regulator.code === "FSC" || h.regulator.code === "FSA" ? <span className="text-slate-500"> {h.regulator.country.replace("British Virgin Islands", "BVI")}</span> : null}
                    <span className="ml-1.5 text-slate-500">{h.entities.length}</span>
                  </Link>
                ))}
                <Link href="/regulators" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--vt-blue)] hover:underline">All regulators <ArrowRight className="size-3.5" aria-hidden /></Link>
              </div>
            </div>
          ) : null}

          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">Common questions</h2>
            <div className="mt-5"><FaqBlock items={faqs} /></div>
            <p className="mt-6 text-xs leading-relaxed text-[var(--vt-muted)]">{NOT_ADVICE_STATEMENT}</p>
          </div>
        </div>
      </div>
    </>
  );
}
