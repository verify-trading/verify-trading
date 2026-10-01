import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Breadcrumbs, CtaBand } from "@/components/marketing/primitives";
import { CtaLink } from "@/components/marketing/cta-link";
import { askCheckHref, EntityAvatar, formatRecordDate, ScoreBar, scoreLabel, VerdictBadge } from "@/components/marketing/entity-ui";
import { Block, EntityMiniCard, FaqBlock, RegulatorCard, TocNav, VerdictBands, WarningBanner } from "@/components/marketing/entity-sections";
import { surface } from "@/components/landing/section-primitives";
import { JsonLd } from "@/components/seo/json-ld";
import type { PublicEntity } from "@/lib/compare/entities";
import { entityFaqs, entityPath, pickAlternatives, vsPartners } from "@/lib/compare/insights";
import { getRegulator } from "@/lib/compare/regulators";
import { INDEPENDENCE_STATEMENT, NOT_ADVICE_STATEMENT } from "@/lib/marketing/copy";
import { webPageSchema } from "@/lib/marketing/seo";

export const ENTITY_LIST_PATH = { broker: "/compare/brokers", propfirm: "/compare/prop-firms" } as const;
const LIST_CRUMB = { broker: "Compare Brokers", propfirm: "Compare Prop Firms" } as const;

export function entityDescription(e: PublicEntity): string {
  const noun = e.type === "broker" ? "broker" : "prop firm";
  const reg = e.regulators.length ? ` Listed regulators: ${e.regulators.slice(0, 3).join(", ")}.` : "";
  const text = `Independent ${noun} check for ${e.name}: verdict ${e.verdict}.${reg} See the record, its basis and last update. Sourced from public records, not paid placement.`;
  return text.length <= 160 ? text : `${text.slice(0, 157).trimEnd()}...`;
}

function lede(e: PublicEntity): string {
  const rating = e.score !== null ? `${e.verdict}, ${e.score.toFixed(1)} out of 10` : e.provisional ? "provisional, awaiting a register check" : e.verdict;
  if (e.type === "propfirm") {
    const state = e.closed ? "is recorded as closed" : e.developing ? "is a developing record that we have not rated yet" : "is recorded as operating";
    return `${e.name} ${state}. Our verdict is ${rating}. Sourced from public operating records and published terms.`;
  }
  const regs = e.regulators.length ? `listed with ${e.regulators.slice(0, 3).join(", ")}` : "not listed with any regulator in our record";
  return `${e.name} is a broker ${regs}. Our verdict is ${rating}. Below: what each regulator means for client protection and how to verify.`;
}

const basisLabel = (e: PublicEntity) => (e.reviewed ? "Reviewed and locked" : e.provisional ? "Provisional, awaiting a register check" : "Awaiting a live register re-check");

export function EntityDetail({ entity: e, all }: { entity: PublicEntity; all: PublicEntity[] }) {
  const listPath = ENTITY_LIST_PATH[e.type];
  const path = entityPath(e);
  const isBroker = e.type === "broker";
  const alternatives = pickAlternatives(e, all).slice(0, 4);
  const partners = isBroker ? vsPartners(e, all).slice(0, 3) : [];
  const faqs = entityFaqs(e).slice(0, 5);
  const refs = e.regulatorDetails;
  const primary = refs.map((r) => (r.slug ? getRegulator(r.slug) : null)).find((r) => r?.registerUrl) ?? null;
  const hubLinks = refs.flatMap((r) => (r.slug ? [getRegulator(r.slug)!] : [])).slice(0, 3);

  const toc = [
    { id: "verdict", label: "What the verdict means" },
    ...(isBroker ? [{ id: "regulation", label: "Who regulates it" }] : []),
    { id: "verify", label: "How to verify" },
    ...(alternatives.length ? [{ id: "alternatives", label: "Alternatives" }] : []),
    { id: "record", label: "The record" },
    { id: "faq", label: "FAQ" },
  ];

  const highlights: Array<[string, string]> = isBroker
    ? [
        ["Regulators", e.regulators.length ? e.regulators.slice(0, 3).join(", ") : "None listed"],
        ["FCA", e.fcaWarning ? "Warning listed" : e.fcaRegistered ? "Registered" : "Not listed"],
        ["Basis", e.reviewed ? "Reviewed" : e.provisional ? "Provisional" : "Awaiting re-check"],
        ["Updated", formatRecordDate(e.updatedAt)],
      ]
    : [
        ["Status", e.closed ? "Closed" : e.developing ? "Developing" : "Operating"],
        ["Founded", e.yearFounded ? String(e.yearFounded) : "Not recorded"],
        ["Score", scoreLabel(e)],
        ["Updated", formatRecordDate(e.updatedAt)],
      ];

  const facts: Array<[string, string]> = [
    ["Verdict", e.verdict],
    ["Score", scoreLabel(e)],
    ["Regulators listed", e.regulatorDetails.length ? e.regulatorDetails.map((r) => (r.country ? `${r.code} (${r.country})` : r.code)).join(", ") : "None listed"],
    ...(isBroker
      ? ([
          ["FCA register", e.fcaRegistered ? `Registered${e.fcaReference ? `, reference ${e.fcaReference}` : ""}` : "Not listed on the FCA register in our record"],
          ["FCA warning", e.fcaWarning ? "On the FCA warning list" : "None recorded"],
          ["Record basis", basisLabel(e)],
        ] as Array<[string, string]>)
      : ([
          ["Status", e.closed ? "Closed" : e.developing ? "Developing, not yet rated" : "Operating"],
          ...(e.yearFounded ? [["Founded", String(e.yearFounded)]] : []),
        ] as Array<[string, string]>)),
    ["Record updated", formatRecordDate(e.updatedAt)],
  ];

  const steps = isBroker
    ? [
        primary
          ? `Open the ${primary.registerLabel}${primary.registerUrl ? ` at ${new URL(primary.registerUrl).host}` : ""}.`
          : "Find the official register of the regulator listed above. Use the regulator's own site, not a link from the broker.",
        primary ? `Search for ${primary.lookupHint}.${e.fcaReference && primary.code === "FCA" ? ` Our record shows reference ${e.fcaReference}.` : ""}` : "Search for the firm's name or licence number.",
        `Check that the licensed legal entity matches ${e.name}'s account terms and that status is current.`,
        "Check permissions cover the instruments you plan to trade.",
      ]
    : [
        "Read the firm's current rules, fees and payout terms on its own site and save a copy before paying.",
        "Confirm the legal company name, jurisdiction and registered address behind the brand.",
        "Look for independent evidence of payouts; treat site testimonials as marketing.",
        "Check whether the firm is regulated. Prop firms selling simulated challenges are rarely regulated brokers.",
      ];

  return (
    <>
      <JsonLd data={webPageSchema({ name: `${e.name} verification record`, description: entityDescription(e), path })} />
      <Breadcrumbs crumbs={[{ name: LIST_CRUMB[e.type], path: listPath }, { name: e.name, path }]} />

      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <div className={`${surface} overflow-hidden rounded-2xl`}>
          <div className="bg-[radial-gradient(ellipse_70%_100%_at_0%_0%,rgba(76,110,245,0.10),transparent_60%)] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-4">
                  <EntityAvatar name={e.name} verdict={e.verdict} className="size-14 text-lg" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]">{isBroker ? "Broker check" : "Prop firm check"}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">Is {e.name} safe?</h1>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300">{lede(e)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 rounded-xl border border-white/[0.08] bg-black/25 px-5 py-4 lg:flex-col lg:items-start lg:gap-3">
                <VerdictBadge verdict={e.verdict} className="px-3 py-1 text-xs" />
                <ScoreBar entity={e} className="w-32" />
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
              {highlights.map(([k, v]) => (
                <div key={k} className="bg-[#0b0f36] px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold text-slate-100" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
            {e.fcaWarning ? (
              <div className="mt-5">
                <WarningBanner title="FCA warning on record">
                  Our record shows the FCA has published a warning about this firm. Read the warning on the FCA&apos;s own site before you deposit.
                  {" "}<a href="https://www.fca.org.uk/scamsmart/warning-list" target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-[var(--vt-coral)] hover:underline">FCA warning list <ExternalLink className="size-3.5" aria-hidden /></a>
                </WarningBanner>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <CtaLink href={askCheckHref(e.name)} event="ask" location={`entity_${e.type}_summary`} className="h-10">
                Run full check <ArrowRight aria-hidden />
              </CtaLink>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-12 lg:py-16">
        <div className="min-w-0 space-y-12">
          {/* 1. What the verdict means */}
          <Block id="verdict" title="What the verdict means" intro={`${e.name} is rated "${e.verdict}". Verdicts come from a fixed, rule-based model applied identically to every entity.`}>
            <VerdictBands current={e.verdict} propFirms={!isBroker} />
            <p className="mt-3 text-xs text-slate-400">
              {isBroker ? `Basis: ${basisLabel(e).toLowerCase()}. ` : ""}
              See the <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">methodology</Link> for sources.
            </p>
          </Block>

          {/* 2. Who regulates it (compact list rows) */}
          {isBroker ? (
            <Block id="regulation" title={`Who regulates ${e.name}`} intro={refs.length ? "Listed regulators from our records. Compact rows with register links:" : undefined}>
              {refs.length ? (
                <div className="divide-y divide-white/10 border-y border-white/10">{refs.map((r) => <RegulatorCard key={`${r.code}-${r.country}`} r={r} entity={e} />)}</div>
              ) : (
                <WarningBanner title="No regulator listed">
                  Our record lists no regulator for {e.name}. Without a licence there is usually no client-money segregation or compensation scheme. Check with the regulator directly before depositing.
                </WarningBanner>
              )}
            </Block>
          ) : refs.length ? (
            <Block id="regulation" title={`Regulators listed for ${e.name}`}>
              <div className="divide-y divide-white/10 border-y border-white/10">{refs.map((r) => <RegulatorCard key={`${r.code}-${r.country}`} r={r} entity={e} />)}</div>
            </Block>
          ) : null}

          {/* 3. How to verify */}
          <Block id="verify" title="How to verify this yourself" intro="Take a few minutes to check official registers directly:">
            <ol className="divide-y divide-white/10 border-y border-white/10">
              {steps.map((s, i) => (
                <li key={s} className="flex gap-4 py-4 sm:gap-6 sm:py-5">
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--vt-coral)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[15px] leading-7 text-slate-300">{s}</p>
                </li>
              ))}
            </ol>
            {isBroker && primary?.registerUrl ? (
              <a href={primary.registerUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Open the {primary.registerLabel} <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </Block>

          {/* 4. Alternatives */}
          {alternatives.length ? (
            <Block
              id="alternatives"
              title={`Alternatives to ${e.name}`}
              intro={isBroker ? "Comparable brokers with an equal or higher score:" : "Comparable prop firms in our records:"}
            >
              <div className="divide-y divide-white/10 border-y border-white/10">{alternatives.map((a) => <EntityMiniCard key={a.slug} e={a} />)}</div>
              {partners.length ? (
                <p className="mt-3 text-xs text-slate-400">
                  Head to head:{" "}
                  {partners.map((p, i) => {
                    const [x, y] = e.slug < p.slug ? [e, p] : [p, e];
                    return (
                      <span key={p.slug}>
                        {i > 0 ? ", " : ""}
                        <Link href={`${entityPath(x)}/vs/${y.slug}`} className="text-[var(--vt-blue)] hover:underline">{e.name} vs {p.name}</Link>
                      </span>
                    );
                  })}
                </p>
              ) : null}
            </Block>
          ) : null}

          {/* 5. The record table */}
          <Block id="record" title="The record" intro="Public verification fields held for this entity:">
            <dl className={`${surface} divide-y divide-white/[0.06] rounded-xl overflow-hidden`}>
              {facts.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <dt className="text-xs uppercase tracking-wider text-slate-400">{k}</dt>
                  <dd className="text-sm font-medium text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-400">
              <p>Check the regulator&apos;s register before depositing. {INDEPENDENCE_STATEMENT}</p>
              <p className="text-[var(--vt-muted)]">{NOT_ADVICE_STATEMENT}</p>
            </div>
          </Block>

          {/* 6. FAQ (≤5) */}
          <Block id="faq" title={`${e.name}: questions answered`}>
            <FaqBlock items={faqs} />
          </Block>

          <nav aria-label="Related" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] pt-6 text-sm">
            <Link href={listPath} className="inline-flex items-center gap-1 font-medium text-[var(--vt-blue)] hover:underline">
              <ArrowRight className="size-3.5 rotate-180" aria-hidden /> {LIST_CRUMB[e.type]}
            </Link>
            {hubLinks.map((r) => (
              <Link key={r.slug} href={`/regulators/${r.slug}`} className="text-[var(--vt-blue)] hover:underline">{r.code} regulated brokers</Link>
            ))}
            <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">How we verify</Link>
          </nav>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TocNav items={toc} />
          </div>
        </aside>
      </div>

      {/* 7. CTA */}
      <CtaBand
        title={`Run the full check on ${e.name}`}
        body="Ask answers from the verified registry with sources, and covers anything this record does not."
        primary={{ label: "Run full check", href: askCheckHref(e.name), event: "ask" }}
        secondary={{ label: "How we verify", href: "/methodology" }}
        location={`entity_${e.type}`}
      />
    </>
  );
}
