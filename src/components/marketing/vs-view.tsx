import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Breadcrumbs, CtaBand } from "@/components/marketing/primitives";
import { askCheckHref, EntityAvatar, formatRecordDate, ScoreBar, scoreLabel, VerdictBadge } from "@/components/marketing/entity-ui";
import { Block, FaqBlock, WarningBanner } from "@/components/marketing/entity-sections";
import { surface } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import type { PublicEntity } from "@/lib/compare/entities";
import { entityPath, VERDICT_RANK } from "@/lib/compare/insights";
import { getRegulator } from "@/lib/compare/regulators";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { webPageSchema } from "@/lib/marketing/seo";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The one-sentence answer, built from the two records. Never a recommendation. */
export function vsSummary(a: PublicEntity, b: PublicEntity): string {
  const shared = a.regulators.filter((r) => b.regulators.includes(r));
  const rankA = VERDICT_RANK[a.verdict];
  const rankB = VERDICT_RANK[b.verdict];
  const rating =
    rankA === rankB
      ? `Both are rated "${a.verdict}" in our records${a.score !== null && b.score !== null && a.score !== b.score ? `, with ${(a.score > b.score ? a : b).name} scoring higher (${Math.max(a.score, b.score).toFixed(1)} against ${Math.min(a.score, b.score).toFixed(1)})` : ""}.`
      : `${rankA < rankB ? a.name : b.name} holds the higher verdict in our records ("${rankA < rankB ? a.verdict : b.verdict}" against "${rankA < rankB ? b.verdict : a.verdict}").`;
  const regs = shared.length ? ` They share ${list(shared)} as a listed regulator.` : " They have no listed regulator in common.";
  return `${rating}${regs} This is a comparison of records, not a recommendation.`;
}

export function VsView({ a, b }: { a: PublicEntity; b: PublicEntity }) {
  const path = `${entityPath(a)}/vs/${b.slug}`;
  const shared = a.regulators.filter((r) => b.regulators.includes(r));
  const onlyA = a.regulators.filter((r) => !b.regulators.includes(r));
  const onlyB = b.regulators.filter((r) => !a.regulators.includes(r));
  const regs = (e: PublicEntity) => (e.regulators.length ? e.regulators.join(", ") : "None listed");
  const rows: Array<[string, string, string]> = [
    ["Verdict", a.verdict, b.verdict],
    ["Score", scoreLabel(a), scoreLabel(b)],
    ["Regulators listed", regs(a), regs(b)],
    ["Number of regulators", String(a.regulators.length), String(b.regulators.length)],
    ["FCA register", a.fcaRegistered ? "Registered" : "Not listed", b.fcaRegistered ? "Registered" : "Not listed"],
    ["FCA warning", a.fcaWarning ? "On the warning list" : "None recorded", b.fcaWarning ? "On the warning list" : "None recorded"],
    ["Record basis", a.reviewed ? "Reviewed" : a.provisional ? "Provisional" : "Awaiting re-check", b.reviewed ? "Reviewed" : b.provisional ? "Provisional" : "Awaiting re-check"],
    ["Record updated", formatRecordDate(a.updatedAt), formatRecordDate(b.updatedAt)],
  ];
  const faqs = [
    { q: `Is ${a.name} or ${b.name} better regulated?`, a: `Regulation depends on the licensed entity, not the brand. In our records ${a.name} lists ${a.regulators.length ? list(a.regulators) : "no regulator"} and ${b.name} lists ${b.regulators.length ? list(b.regulators) : "no regulator"}. Check each licence on the regulator's register.` },
    { q: `Which has the higher verdict, ${a.name} or ${b.name}?`, a: vsSummary(a, b) },
    { q: `Do ${a.name} and ${b.name} share a regulator?`, a: shared.length ? `Yes: ${list(shared)}.` : "Not in our records." },
  ];
  const names = [a, b];

  return (
    <>
      <JsonLd data={webPageSchema({ name: `${a.name} vs ${b.name}`, description: vsSummary(a, b), path })} />
      <Breadcrumbs crumbs={[{ name: "Compare Brokers", path: "/compare/brokers" }, { name: `${a.name} vs ${b.name}`, path }]} />
      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">Broker comparison</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{a.name} vs {b.name}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-300">{vsSummary(a, b)}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {names.map((e) => (
            <div key={e.slug} className={`${surface} p-5`}>
              <div className="flex items-center gap-3">
                <EntityAvatar name={e.name} verdict={e.verdict} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-white">{e.name}</p>
                  <VerdictBadge verdict={e.verdict} className="mt-1" />
                </div>
                <ScoreBar entity={e} className="w-24 shrink-0" />
              </div>
              <Link href={entityPath(e)} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--vt-blue)] hover:underline">Full {e.name} record <ArrowRight className="size-3.5" aria-hidden /></Link>
            </div>
          ))}
        </div>

        {a.fcaWarning || b.fcaWarning ? (
          <div className="mt-5"><WarningBanner title="FCA warning on record">{[a, b].filter((e) => e.fcaWarning).map((e) => e.name).join(" and ")} {a.fcaWarning && b.fcaWarning ? "have" : "has"} an FCA warning in our record. Read it on the FCA&apos;s site before you deposit.</WarningBanner></div>
        ) : null}

        <div className="mt-12 space-y-14">
          <Block id="table" title="Side by side">
            <div className={`${surface} overflow-hidden`}>
              <div className="grid grid-cols-[minmax(6.5rem,0.8fr)_1fr_1fr] gap-x-3 border-b border-white/[0.08] bg-black/20 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-5">
                <span />
                <span className="truncate text-slate-300">{a.name}</span>
                <span className="truncate text-slate-300">{b.name}</span>
              </div>
              <dl className="divide-y divide-white/[0.06]">
                {rows.map(([k, x, y]) => (
                  <div key={k} className="grid grid-cols-[minmax(6.5rem,0.8fr)_1fr_1fr] gap-x-3 px-4 py-3 text-sm sm:px-5">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-100">{x}</dd>
                    <dd className="font-medium text-slate-100">{y}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Block>

          <Block id="regulators" title="Regulators compared">
            <div className="grid gap-6 sm:grid-cols-3">
              {([["Shared", shared], [`Only ${a.name}`, onlyA], [`Only ${b.name}`, onlyB]] as Array<[string, string[]]>).map(([t, xs]) => (
                <div key={t} className="border-t border-white/10 pt-4">
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">{t}</p>
                  <p className="mt-2 text-sm text-slate-200">{xs.length ? xs.join(", ") : "None"}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              What each licence means for clients is on the regulator pages, for example the{" "}
              {[...new Set([...a.regulatorDetails, ...b.regulatorDetails].flatMap((r) => (r.slug ? [r.slug] : [])))].slice(0, 4).map((s, i) => (
                <span key={s}>{i > 0 ? ", " : ""}<Link href={`/regulators/${s}`} className="text-[var(--vt-blue)] hover:underline">{getRegulator(s)?.code ?? s}</Link></span>
              ))}{" "}
              pages, or browse <Link href="/regulators" className="text-[var(--vt-blue)] hover:underline">all regulators</Link>.
            </p>
          </Block>

          <Block id="faq" title="Frequently asked questions"><FaqBlock items={faqs} /></Block>

          <div className="space-y-2 text-sm leading-relaxed text-slate-400">
            <p>Compared on record fields only. We hold no spreads, fees or user ratings for these brokers, so this page does not compare them. See <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">how we verify</Link>.</p>
            <p>{INDEPENDENCE_STATEMENT}</p>
            <p className="text-xs text-[var(--vt-muted)]">{NOT_ADVICE_STATEMENT}</p>
          </div>
        </div>
      </section>
      <CtaBand
        title={`Check ${a.name} or ${b.name} in Ask`}
        body="Ask answers from the verified registry with sources, and covers anything a record does not."
        primary={{ label: `Check ${a.name}`, href: askCheckHref(a.name), event: "ask" }}
        secondary={{ label: `Check ${b.name}`, href: askCheckHref(b.name) }}
        location="entity_vs"
      />
    </>
  );
}
