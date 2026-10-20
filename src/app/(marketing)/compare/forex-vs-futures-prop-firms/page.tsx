import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { ScoreBar, VerdictBadge, scoreLabel } from "@/components/marketing/entity-ui";
import { Breadcrumbs, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { entityPath, isSeoWorthy } from "@/lib/compare/insights";
import { getPublicEntities, type PublicEntity } from "@/lib/compare/entities";
import { pageMetadata } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";

const path = "/compare/forex-vs-futures-prop-firms";
const description =
  "Forex vs futures prop firms compared: markets, drawdown models, costs and who each model suits, with verified firm examples and Verify Trading verdicts.";

export const metadata: Metadata = pageMetadata({
  title: "Forex vs Futures Prop Firms: Which to Choose",
  description,
  path,
});

/** At-a-glance comparison rows: a dimension and how each model handles it. */
const GLANCE: Array<{ dimension: string; forex: string; futures: string }> = [
  {
    dimension: "Markets",
    forex: "Currencies, indices, metals, CFDs (24/5)",
    futures: "Exchange-traded futures (CME: ES, NQ, CL, GC, etc.), regulated venue",
  },
  {
    dimension: "Typical account",
    forex: "$100,000 evaluation common",
    futures: "$50,000 evaluation common",
  },
  {
    dimension: "Profit target",
    forex: "Percentage-based (e.g. ~8–10% then 5% on a 2-step)",
    futures: "Dollar-based (e.g. ~$3,000 on a $50K)",
  },
  {
    dimension: "Drawdown",
    forex: "% daily loss (~5%) + % max loss (~10%), static or trailing",
    futures: "Dollar trailing (end-of-day or intraday), e.g. ~$2,000–2,500",
  },
  {
    dimension: "Cost model",
    forex: "One-time challenge fee (often discounted)",
    futures: "Monthly subscription common, some one-time",
  },
  {
    dimension: "Profit split",
    forex: "Commonly ~80%, scaling toward 90–100%",
    futures: "Commonly ~80–90%, plus activation fees on some",
  },
  {
    dimension: "Best suited to",
    forex: "Swing/position traders, global macro, 24/5 flexibility",
    futures: "Intraday/day traders, US index & commodity futures, no overnight swap",
  },
];

/** Example firms we verify on each side, grouped by model. */
const EXAMPLES: Array<{ model: string; names: string[] }> = [
  { model: "Futures", names: ["Topstep", "TradeDay"] },
  { model: "Forex", names: ["FTMO", "The5ers"] },
];

const FAQS = [
  {
    q: "Are forex or futures prop firms better?",
    a: "Neither is universally better — it depends on what you trade. Futures suit intraday traders of US index and commodity markets on a regulated exchange; forex suits traders of currencies and indices as CFDs who want 24/5 flexibility. Compare the rules and verify the firm either way.",
  },
  {
    q: "Are forex or futures prop firms cheaper?",
    a: "Forex challenges are usually a one-time fee (often discounted); futures evaluations are often a monthly subscription. The cheaper total depends on how long you take to pass and on resets, renewals and activation fees — not the headline price.",
  },
  {
    q: "What is the main difference in drawdown rules?",
    a: "Forex firms typically use percentage-based limits (for example 5% daily, 10% maximum); futures firms typically use a dollar trailing drawdown that rises with your balance and does not fall back. They behave very differently in practice.",
  },
  {
    q: "Can I trade both forex and futures prop firms?",
    a: "Yes. Many traders hold evaluations with firms on both sides. Verify each firm independently before committing.",
  },
  {
    q: "Do both use simulated accounts?",
    a: "Most retail prop evaluations on both sides are simulated, and many funded accounts remain simulated with the firm paying real profit splits. Always check the funded-stage agreement.",
  },
];

/** Case-insensitive name match against the public prop-firm records. */
function matchEntity(entities: PublicEntity[], name: string): PublicEntity | undefined {
  const target = name.toLowerCase();
  return entities.find((e) => e.name.toLowerCase() === target);
}

export default async function ForexVsFuturesPropFirmsPage() {
  const propFirms = await getPublicEntities("propfirm");
  const exampleGroups = EXAMPLES.map((group) => ({
    model: group.model,
    firms: group.names.map((name) => ({ name, entity: matchEntity(propFirms, name) })),
  }));

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: "Compare", path: "/compare/prop-firms" },
          { name: "Forex vs Futures Prop Firms", path },
        ]}
      />
      <JsonLd data={faqPageSchema(FAQS)} />

      <PageHero
        eyebrow="Compare"
        title="Forex vs Futures Prop Firms: Which Should You Choose?"
        lede="Forex and futures prop firms both fund traders who pass an evaluation, but they differ in the markets you trade, how drawdown and targets are calculated, and how you pay for the challenge. The right choice depends on what you trade and how you manage risk — not on which looks cheaper up front. Here's how the two models compare, with verified firm examples from each side."
        primary={{ label: "Compare futures prop firms", href: "/compare/futures-prop-firms" }}
        secondary={{ label: "Compare forex prop firms", href: "/compare/forex-prop-firms" }}
        location="forex_vs_futures_prop_firms"
      />

      <Section
        eyebrow="Overview"
        title="At a Glance"
        intro="A side-by-side look at how the two models differ across the dimensions that matter most."
      >
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[var(--vt-muted)]">
                <th scope="col" className="px-4 py-3 font-semibold">Dimension</th>
                <th scope="col" className="px-4 py-3 font-semibold">Forex prop firms</th>
                <th scope="col" className="px-4 py-3 font-semibold">Futures prop firms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {GLANCE.map((row) => (
                <tr key={row.dimension} className="align-top text-slate-300">
                  <td className="px-4 py-4 font-medium text-white">{row.dimension}</td>
                  <td className="px-4 py-4">{row.forex}</td>
                  <td className="px-4 py-4">{row.futures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          General comparison of the two models; individual firm terms vary and change frequently.
        </p>
      </Section>

      <Section eyebrow="Markets" title="The Markets You Trade" narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Forex and CFD prop firms give access to currency pairs, indices and metals traded as CFDs, running nearly 24/5, usually on MT4, MT5, cTrader or DXtrade. Futures prop firms give access to exchange-listed futures on regulated venues such as CME Group — index futures (ES, NQ), energy (CL) and metals (GC) — usually on NinjaTrader, Tradovate or Rithmic, during exchange hours. Futures are centrally cleared and regulated as an asset class, whereas the forex/CFD side is traded over the counter. On both sides, most retail prop evaluations are simulated until you are funded."}
        </p>
      </Section>

      <Section eyebrow="Drawdown" title="How Drawdown Differs" narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Forex firms typically use percentage-based limits: roughly a 5% maximum daily loss and a 10% maximum overall loss, which may be a static floor or trail upward with your balance. Futures firms typically use a dollar trailing drawdown — an end-of-day or intraday threshold, for example around $2,000, that ratchets up as the account balance grows and never moves back down. A dollar trailing drawdown behaves very differently from a static percentage floor, especially after a winning run or when you hold positions through volatility: the threshold can sit much closer to your current balance than the headline number suggests, leaving less room than a fixed floor would."}
        </p>
      </Section>

      <Section eyebrow="Costs" title="What You Pay" narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Forex challenges are usually a one-time fee, frequently discounted through standing promotions. Futures evaluations are often a monthly subscription that runs until you pass, sometimes with an activation fee once you are funded; some futures firms also offer one-time pricing. The cheapest headline price is not the cheapest total cost once resets, activation fees and monthly renewals are counted — a low monthly price can cost more than a one-time fee if it takes several months to pass. All of these numbers change frequently, so check the current terms before you buy."}
        </p>
      </Section>

      <Section eyebrow="Decision" title="Which Suits You?" narrow>
        <div className="space-y-4 text-[15px] leading-7 text-slate-300">
          <p>
            {"Choose futures if you day-trade US index or commodity markets, want a regulated exchange and no overnight swap, and are comfortable with a dollar trailing drawdown."}
          </p>
          <p>
            {"Choose forex if you trade currencies or indices as CFDs, want 24/5 flexibility and swing or position trades, and prefer percentage-based rules."}
          </p>
          <p>
            {"Many traders verify a firm on each side and keep both, using whichever model fits the trade in front of them."}
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Verified examples"
        title="Verified Examples From Each"
        intro="A few firms we've verified on each side — explore the full lists via the links below."
        band
      >
        <div className="space-y-8">
          {exampleGroups.map((group) => (
            <div key={group.model}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--vt-muted)]">{group.model}</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {group.firms.map(({ name, entity }) => {
                  const linked = entity && isSeoWorthy(entity);
                  return (
                    <div
                      key={name}
                      className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold tracking-tight text-white">{name}</h4>
                        {entity ? (
                          <span className="inline-flex items-center gap-2">
                            <VerdictBadge verdict={entity.verdict} />
                            <span className="text-xs text-slate-400">{scoreLabel(entity)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Not recorded</span>
                        )}
                      </div>
                      {entity ? <ScoreBar entity={entity} className="mt-3" /> : null}
                      {linked ? (
                        <Link
                          href={entityPath(entity)}
                          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                        >
                          View the {name} verification record
                        </Link>
                      ) : (
                        <Link
                          href={`/compare/prop-firms?q=${encodeURIComponent(name)}`}
                          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                        >
                          Find {name} in the prop firm list
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/compare/futures-prop-firms"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--vt-blue)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--vt-blue)]/90"
          >
            Compare futures prop firms
          </Link>
          <Link
            href="/compare/forex-prop-firms"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Compare forex prop firms
          </Link>
        </div>
      </Section>

      <Section eyebrow="Verification" title="Why Verify Either Way" narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Whichever model you pick, the firm's trustworthiness and payout reliability matter more than its marketing. A compelling evaluation means little if the firm behind it does not pay out reliably. Verify Trading provides independent records for firms on both sides, so you can research the company alongside its published programme terms before committing."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/compare/prop-firms"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--vt-blue)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--vt-blue)]/90"
          >
            Explore prop firm verifications
          </Link>
        </div>
      </Section>

      <FaqSection items={FAQS} title="Forex vs futures prop firm questions, answered" schema={false} />

      <CtaBand
        title="Compare and Verify Before You Choose"
        body="The right choice is about matching the model to how you trade — and then checking the firm behind it. Compare the markets, drawdown and costs of each model, read the verification records, and make a more informed decision whichever side you land on."
        primary={{ label: "Compare futures prop firms", href: "/compare/futures-prop-firms" }}
        secondary={{ label: "Compare forex prop firms", href: "/compare/forex-prop-firms" }}
        location="forex_vs_futures_prop_firms"
      />
    </>
  );
}
