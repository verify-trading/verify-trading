import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Breadcrumbs, CtaBand } from "@/components/marketing/primitives";
import { Block, FaqBlock, StandingBadge, TocNav, VerdictBands } from "@/components/marketing/entity-sections";
import { EntityAvatar, formatRecordDate, ScoreBar, VerdictBadge } from "@/components/marketing/entity-ui";
import { surface } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import type { PublicEntity } from "@/lib/compare/entities";
import { entityPath, type HubStats } from "@/lib/compare/insights";
import { REGULATORS, STANDING_LABEL, STANDING_NOTE, type Standing } from "@/lib/compare/regulators";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { itemListSchema, webPageSchema } from "@/lib/marketing/seo";

const STANDINGS: Standing[] = ["major", "regional", "offshore", "registration"];
const ROW_CAP = 60;

const GENERAL_FAQS = [
  {
    q: "What is the difference between an onshore and an offshore licence?",
    a: "An onshore regulator such as the FCA, CySEC or ASIC supervises firms under full conduct rules and usually gives clients a complaints route and, in some regimes, a compensation scheme. Offshore licensing centres often serve clients outside their own borders, with lighter rules and rarely a compensation scheme.",
  },
  {
    q: "Does a licence mean a broker is safe?",
    a: "No. A licence shows a regulator authorised a specific legal entity for specific activities. It does not guarantee the firm will not fail or treat clients fairly. Check the entity you actually contract with, and that its status is current.",
  },
  {
    q: "How do I check a broker's licence?",
    a: "Go to the regulator's own register, not a link from the broker. Search the firm's name or licence number, confirm the licensed legal entity matches the company in your account terms, and check the status and permissions.",
  },
  {
    q: "Why do some brokers list several regulators?",
    a: "A broker group often runs separate legal entities in different countries, each with its own licence. The protections you receive depend on which entity holds your account, so read the account terms.",
  },
];

/** Segmented bar of verdict counts. Decorative: the counts are also written out beside it. */
function VerdictSplit({ verdicts, total }: { verdicts: HubStats["verdicts"]; total: number }) {
  const tones: Array<[keyof HubStats["verdicts"], string]> = [
    ["Strongly Trusted", "bg-[var(--vt-green)]"],
    ["Trusted", "bg-[var(--vt-green)]/60"],
    ["Proceed With Caution", "bg-[var(--vt-amber)]"],
    ["High Risk", "bg-[var(--vt-coral)]/70"],
    ["Avoid", "bg-[var(--vt-coral)]"],
    ["Not yet rated", "bg-slate-500"],
  ];
  return (
    <div aria-hidden className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      {tones.map(([v, cls]) => (verdicts[v] ? <span key={v} className={cls} style={{ width: `${((verdicts[v] ?? 0) / total) * 100}%` }} /> : null))}
    </div>
  );
}

/* ─── /regulators ─── */

export function RegulatorsIndex({ hubs, total }: { hubs: HubStats[]; total: number }) {
  const shown = hubs.filter((h) => h.entities.length > 0);
  const path = "/regulators";
  return (
    <>
      <JsonLd data={webPageSchema({ name: "Broker regulators", description: "Regulators listed in the verify.trading register, what each protects and how to check its register.", path })} />
      <JsonLd data={itemListSchema({ name: "Broker regulators", items: shown.map((h) => ({ name: h.regulator.name, path: `/regulators/${h.regulator.slug}` })) })} />
      <Breadcrumbs crumbs={[{ name: "Regulators", path }]} />
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">Regulators</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Broker regulators, and what a licence means</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-400">
          {shown.length} regulators appear in our register across {total.toLocaleString("en-GB")} brokers. For each: who they are, what protection a client gets, how to check the register, and every broker in our data that lists them.
        </p>

        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {STANDINGS.map((s) => (
            <div key={s} className="border-t border-white/10 pt-4">
              <StandingBadge standing={s} />
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{STANDING_NOTE[s]}</p>
            </div>
          ))}
        </div>

        {STANDINGS.map((s) => {
          const group = shown.filter((h) => h.regulator.standing === s).sort((a, b) => b.entities.length - a.entities.length);
          if (!group.length) return null;
          return (
            <div key={s} className="mt-12">
              <h2 className="text-lg font-bold text-white">{STANDING_LABEL[s]}</h2>
              <ul className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((h) => (
                  <li key={h.regulator.slug} className="border-t border-white/10 pt-4">
                    <Link href={`/regulators/${h.regulator.slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-mono text-lg font-bold text-white transition-colors group-hover:text-[var(--vt-coral)]">{h.regulator.code}</p>
                        <p className="font-mono text-xs text-slate-500">{h.entities.length.toLocaleString("en-GB")} {h.entities.length === 1 ? "broker" : "brokers"}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-300 group-hover:underline">{h.regulator.name}</p>
                      <p className="text-xs text-slate-500">{h.regulator.country}</p>
                      <div className="mt-3"><VerdictSplit verdicts={h.verdicts} total={h.entities.length} /></div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="mt-12 max-w-3xl">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Regulator questions</h2>
          <div className="mt-5"><FaqBlock items={GENERAL_FAQS} /></div>
          <p className="mt-6 text-xs leading-relaxed text-[var(--vt-muted)]">{NOT_ADVICE_STATEMENT}</p>
        </div>
      </section>
    </>
  );
}

/* ─── /regulators/[slug] ─── */

function HubRow({ e, hub }: { e: PublicEntity; hub: string }) {
  const others = e.regulators.filter((r) => r !== hub);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-white/[0.035] sm:px-5">
      <EntityAvatar name={e.name} verdict={e.verdict} className="size-9" />
      <div className="min-w-0 flex-1 basis-40">
        <Link href={entityPath(e)} className="block truncate text-[15px] font-semibold text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60">{e.name}</Link>
        <p className="truncate text-xs text-slate-500">{others.length ? `Also: ${others.slice(0, 3).join(", ")}${others.length > 3 ? ` +${others.length - 3}` : ""}` : `Updated ${formatRecordDate(e.updatedAt)}`}</p>
      </div>
      <VerdictBadge verdict={e.verdict} />
      <ScoreBar entity={e} className="w-24" />
    </li>
  );
}

export function RegulatorHub({ hub, uniqueCode, others }: { hub: HubStats; uniqueCode: boolean; others: HubStats[] }) {
  const { regulator: r, entities, verdicts } = hub;
  const path = `/regulators/${r.slug}`;
  const n = entities.length;
  const top = entities.filter((e) => e.score !== null);
  const faqs = [
    { q: `What protection does a ${r.code} licence give clients?`, a: `${r.protections.join(" ")} These are general facts about the regime; what applies to you depends on the licensed entity and your client category.` },
    { q: `How many brokers list ${r.code} in your register?`, a: `${n.toLocaleString("en-GB")} of the brokers in our register list ${r.name} (${r.code}). Records are refreshed as new regulator information is checked, and a listing here is a pointer, not proof of a current licence.` },
    { q: `How do I check a ${r.code} licence?`, a: r.registerUrl ? `Open the ${r.registerLabel} and search for ${r.lookupHint}. Confirm the licensed legal entity matches the company in your account terms and that its status is current.` : `Find ${r.name}'s official website and its register, and search for ${r.lookupHint}. Confirm the licensed legal entity matches the company in your account terms.` },
    ...GENERAL_FAQS.slice(1, 2),
  ];
  const toc = [
    { id: "about", label: `About ${r.code}` },
    { id: "verify", label: "Check the register" },
    { id: "brokers", label: "Brokers listing it" },
    { id: "verdicts", label: "Verdicts" },
    { id: "faq", label: "FAQ" },
  ];
  const steps = [
    r.registerUrl ? `Open the ${r.registerLabel} (${new URL(r.registerUrl).host}).` : `Find ${r.name}'s official website. Use a search engine or a government directory, not a link from the broker.`,
    `Search for ${r.lookupHint}.`,
    "Confirm the licensed legal entity is the company named in your account terms, and that its status is current.",
    "Check the licence or permissions cover the products you want to trade.",
  ];

  return (
    <>
      <JsonLd data={webPageSchema({ name: `Brokers regulated by ${r.code}`, description: r.summary, path })} />
      <JsonLd data={itemListSchema({ name: `Brokers listing ${r.code}`, items: entities.slice(0, ROW_CAP).map((e) => ({ name: e.name, path: entityPath(e) })) })} />
      <Breadcrumbs crumbs={[{ name: "Regulators", path: "/regulators" }, { name: r.code, path }]} />

      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <div className={`${surface} bg-[radial-gradient(ellipse_70%_100%_at_0%_0%,rgba(76,110,245,0.10),transparent_60%)] p-5 sm:p-7`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">Regulator</p>
            <StandingBadge standing={r.standing} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white sm:text-4xl">{r.code} regulated brokers</h1>
          <p className="mt-1 text-sm text-slate-500">{r.name}, {r.country}</p>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-300">
            {n.toLocaleString("en-GB")} {n === 1 ? "broker lists" : "brokers list"} {r.code} in our register. {r.summary}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
            {([
              ["Brokers listed", n.toLocaleString("en-GB")],
              ["Trusted or better", String((verdicts["Strongly Trusted"] ?? 0) + (verdicts.Trusted ?? 0))],
              ["Caution or worse", String((verdicts["Proceed With Caution"] ?? 0) + (verdicts["High Risk"] ?? 0) + (verdicts.Avoid ?? 0))],
              ["Regulator country", r.country.replace(/ \(.*\)/, "")],
            ] as Array<[string, string]>).map(([k, v]) => (
              <div key={k} className="bg-[#0b0f36] px-3.5 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt>
                <dd className="mt-0.5 truncate text-sm font-medium text-slate-100" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12 lg:py-16">
        <aside className="hidden lg:block"><div className="sticky top-24"><TocNav items={toc} /></div></aside>
        <div className="min-w-0 space-y-12">
          <Block id="about" title={`What ${r.code} protection means`} intro="General facts about the regime. What applies to you depends on the licensed entity and your client category.">
            <div className="border-t border-white/10 pt-4">
              <ul className="space-y-2.5">
                {r.protections.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] leading-7 text-slate-300">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--vt-coral)]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-slate-400">{STANDING_LABEL[r.standing]}. {STANDING_NOTE[r.standing]}</p>
            </div>
          </Block>

          <Block id="verify" title={`How to check the ${r.code} register`}>
            <ol className="divide-y divide-white/10 border-y border-white/10">
              {steps.map((s, i) => (
                <li key={s} className="flex gap-4 py-4 sm:gap-6 sm:py-5">
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--vt-coral)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[15px] leading-7 text-slate-300">{s}</p>
                </li>
              ))}
            </ol>
            {r.registerUrl ? (
              <a href={r.registerUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
                {r.registerLabel} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </Block>

          <Block id="brokers" title={`Brokers that list ${r.code}`} intro={`Sorted by score, best first${n > ROW_CAP ? `. Showing ${ROW_CAP} of ${n.toLocaleString("en-GB")}` : ""}. A listing is a pointer to check, not proof of a current licence.`}>
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
              {entities.slice(0, ROW_CAP).map((e) => <HubRow key={e.slug} e={e} hub={r.code} />)}
            </ul>
            {n > ROW_CAP && uniqueCode ? (
              <Link href={`/compare/brokers?regulator=${encodeURIComponent(r.code)}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--vt-blue)] hover:underline">
                Browse all {n.toLocaleString("en-GB")} in Compare Brokers <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
            {top.length === 0 ? <p className="mt-3 text-sm text-slate-500">None of these records has a score yet.</p> : null}
          </Block>

          <Block id="verdicts" title={`Verdicts for ${r.code} brokers`} intro="How the brokers that list this regulator are spread across our verdict bands.">
            <VerdictBands counts={verdicts} propFirms />
          </Block>

          <Block id="faq" title={`${r.code}: frequently asked questions`}><FaqBlock items={faqs} /></Block>

          {others.length ? (
            <nav aria-label="Related regulators" className="border-t border-white/[0.06] pt-6">
              <p className="text-sm font-semibold text-white">Other {STANDING_LABEL[r.standing].toLowerCase()}s</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {others.map((o) => (
                  <Link key={o.regulator.slug} href={`/regulators/${o.regulator.slug}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white">
                    {o.regulator.code} <span className="text-slate-500">{o.entities.length}</span>
                  </Link>
                ))}
              </div>
              <Link href="/regulators" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--vt-blue)] hover:underline"><ArrowRight className="size-3.5 rotate-180" aria-hidden /> All regulators</Link>
            </nav>
          ) : null}
          <p className="text-xs leading-relaxed text-[var(--vt-muted)]">{INDEPENDENCE_STATEMENT} {NOT_ADVICE_STATEMENT}</p>
        </div>
      </div>

      <CtaBand
        title={`Check a ${r.code} broker in Ask`}
        body="Ask answers from the verified registry with sources, and covers anything a record does not."
        primary={{ label: "Run a check", href: "/ask", event: "ask" }}
        secondary={{ label: "How we verify", href: "/methodology" }}
        location="regulator_hub"
      />
    </>
  );
}

export const isUniqueCode = (code: string) => REGULATORS.filter((r) => r.code === code).length === 1;
