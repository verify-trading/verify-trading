import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { ScoreBar, VerdictBadge, scoreLabel } from "@/components/marketing/entity-ui";
import { Breadcrumbs, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { entityPath, isSeoWorthy } from "@/lib/compare/insights";
import { getPublicEntities, type PublicEntity } from "@/lib/compare/entities";
import { pageMetadata } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";

const path = "/compare/forex-prop-firms";
/** When the facts on this page were last verified against each firm's site. The sitemap and the TL;DR both read this. */
export const REVIEWED = "2026-10-20";
const REVIEWED_LABEL = `Reviewed ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(REVIEWED))}`;

const description =
  "Compare the top forex prop firms by challenge fees, profit targets, drawdown limits and profit splits. FTMO, The5ers, FundingPips and their Verify Trading verdicts.";

export const metadata: Metadata = pageMetadata({
  title: "Forex Prop Firms Compared: Fees, Rules & Drawdown",
  description,
  path,
});

/** The three named forex firms, in the order they appear on the page, with their programme row data. */
const FIRMS: Array<{
  name: string;
  challenge: string;
  fee: string;
  profitTarget: string;
  maxDailyLoss: string;
  maxTotalLoss: string;
  profitSplit: string;
  site: string;
}> = [
  {
    name: "FTMO",
    challenge: "FTMO Challenge (2-step, $100K)",
    fee: "~€540 one-time (often discounted)",
    profitTarget: "10% / 5%",
    maxDailyLoss: "5%",
    maxTotalLoss: "10% (static)",
    profitSplit: "80%, up to 90%",
    site: "https://ftmo.com",
  },
  {
    name: "The5ers",
    challenge: "High Stakes (2-step, $100K)",
    fee: "~$405 one-time (promo plans far cheaper)",
    profitTarget: "10% / 5%",
    maxDailyLoss: "5%",
    maxTotalLoss: "10% (static)",
    profitSplit: "80%, scaling to 100%",
    site: "https://www.the5ers.com",
  },
  {
    name: "FundingPips",
    challenge: "2-Step Evaluation ($100K)",
    fee: "~$522–529 one-time (routinely ~20% off)",
    profitTarget: "8% / 5%",
    maxDailyLoss: "5%",
    maxTotalLoss: "10% (static)",
    profitSplit: "60–90% (by payout cadence)",
    site: "https://fundingpips.com",
  },
];

const FIRM_BLURBS: Record<string, string> = {
  FTMO:
    "FTMO's $100K Challenge is a two-step evaluation: a 10% profit target in Phase 1, then 5% in Phase 2, with a 5% maximum daily loss and a 10% maximum overall loss (a static floor based on end-of-day balance). The funded account starts at an 80% profit split, scaling toward 90%, and the evaluation fee is refunded on your first payout. FTMO also offers a one-step version with a tighter 3% daily loss and a trailing overall limit. The list fee (around €540 for the $100K tier) is frequently reduced by standing discounts, so check the current price.",
  The5ers:
    "The5ers' flagship High Stakes programme is a two-step evaluation on a $100K account — a 10% then 5% profit target, a 5% maximum daily loss and a 10% static maximum loss. The funded split starts at 80% and scales up to 100% as the account grows through their scaling plan. Note that The5ers frequently sells the same $100K account size far more cheaply through promotional plans (its 'Summer Plan' line has listed a $100K two-step account around $149), so the standard list price is rarely the real cost — verify current pricing.",
  FundingPips:
    "FundingPips runs a two-step evaluation ($100K) with an 8% then 5% profit target, a 5% maximum daily loss (measured off the higher of opening balance or equity) and a 10% static maximum loss. The funded 'Master' stage pays a profit split that scales with payout cadence — roughly 60% weekly up to 90% on demand. The list fee (around $522–$529) is routinely discounted ~20% with a code, so confirm the current price before buying.",
};

const FAQS = [
  {
    q: "What are forex prop firms?",
    a: "Forex prop firms run evaluation challenges that, once passed, give traders access to a funded or simulated-funded account to trade currencies and CFDs under set risk rules, sharing a portion of any profits.",
  },
  {
    q: "Which forex prop firm has the lowest challenge fee?",
    a: "List fees are similar across the top firms, but all of them discount heavily and run promotional plans, so the lowest effective price changes constantly — always compare the current checkout price, not the list price.",
  },
  {
    q: "What is the difference between a one-step and a two-step challenge?",
    a: "A two-step challenge splits the profit target across two phases (for example 10% then 5%); a one-step asks for the target in a single phase but often pairs it with a tighter daily loss limit or a trailing drawdown.",
  },
  {
    q: "What is the difference between static and trailing drawdown?",
    a: "A static maximum loss is a fixed floor (for example $90,000 on a $100K account). A trailing drawdown rises as your balance or equity grows and does not fall back, so it can sit closer to your current balance after a winning run.",
  },
  {
    q: "Do forex prop firms scale profit splits?",
    a: "Many do. Splits commonly start around 80% and rise toward 90–100% through a scaling plan or faster payout cadence, depending on the firm. Always read the funded-stage agreement.",
  },
  {
    q: "How do I check a forex prop firm before joining?",
    a: "Review its official challenge terms and funded-stage agreement, then check its independent verification record. Verify Trading provides individual firm profiles for further research.",
  },
];

/** Case-insensitive name match against the public prop-firm records. */
function matchEntity(entities: PublicEntity[], name: string): PublicEntity | undefined {
  const target = name.toLowerCase();
  return entities.find((e) => e.name.toLowerCase() === target);
}

export default async function ForexPropFirmsPage() {
  const propFirms = await getPublicEntities("propfirm");
  const rows = FIRMS.map((firm) => ({ firm, entity: matchEntity(propFirms, firm.name) }));

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: "Compare", path: "/compare/prop-firms" },
          { name: "Forex Prop Firms", path },
        ]}
      />
      <JsonLd data={faqPageSchema(FAQS)} />

      <PageHero
        eyebrow="Compare"
        title="Compare Forex Prop Firms: Fees, Rules & Drawdown"
        lede="Compare FTMO, The5ers and FundingPips on their standard 2-step $100K challenges: fees, profit targets, drawdown and profit split, then check each firm's independent verdict."
        tldr={[
          "All three 2-step $100K challenges use a 5% maximum daily loss and a 10% static maximum loss.",
          "Profit targets: FTMO and The5ers 10% then 5%; FundingPips 8% then 5%.",
          "Funded splits: FTMO 80% up to 90%, The5ers 80% up to 100%, FundingPips 60% to 90% by payout cadence.",
          "List prices are rarely what you pay: all three run standing discounts, so check the live checkout price.",
        ]}
        tldrNote={REVIEWED_LABEL}
        primary={{ label: "See the Comparison Table", href: "#comparison" }}
        secondary={{ label: "Verify a Prop Firm", href: "/verify" }}
        location="forex_prop_firms"
      />

      <Section
        id="comparison"
        eyebrow="Comparison"
        title="Forex Prop Firm Comparison Table"
        intro="The table below compares each firm's standard 2-step $100,000 evaluation using published programme terms. We lead with our independent Verify Trading verdict, not the fee."
      >
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[var(--vt-muted)]">
                <th scope="col" className="px-4 py-3 font-semibold">Firm</th>
                <th scope="col" className="px-4 py-3 font-semibold">Flagship Challenge</th>
                <th scope="col" className="px-4 py-3 font-semibold">List Fee</th>
                <th scope="col" className="px-4 py-3 font-semibold">Profit Target (P1 / P2)</th>
                <th scope="col" className="px-4 py-3 font-semibold">Max Daily Loss</th>
                <th scope="col" className="px-4 py-3 font-semibold">Max Total Loss</th>
                <th scope="col" className="px-4 py-3 font-semibold">Profit Split</th>
                <th scope="col" className="px-4 py-3 font-semibold">VT Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map(({ firm, entity }) => {
                const linked = entity && isSeoWorthy(entity);
                const firmCell = linked ? (
                  <Link href={entityPath(entity)} className="font-medium text-white hover:text-[var(--vt-coral)]">
                    {firm.name}
                  </Link>
                ) : (
                  <span className="font-medium text-white">{firm.name}</span>
                );
                return (
                  <tr key={firm.name} className="align-top text-slate-300">
                    <td className="px-4 py-4">{firmCell}</td>
                    <td className="px-4 py-4">{firm.challenge}</td>
                    <td className="px-4 py-4">{firm.fee}</td>
                    <td className="px-4 py-4">{firm.profitTarget}</td>
                    <td className="px-4 py-4">{firm.maxDailyLoss}</td>
                    <td className="px-4 py-4">{firm.maxTotalLoss}</td>
                    <td className="px-4 py-4">{firm.profitSplit}</td>
                    <td className="px-4 py-4">
                      {entity ? (
                        <span className="inline-flex items-center gap-2">
                          <VerdictBadge verdict={entity.verdict} />
                          <span className="text-xs text-slate-400">{scoreLabel(entity)}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not recorded</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          {"Published evaluation terms as of October 20, 2026; these change frequently. All three firms run standing discounts, so the list fee is usually not what you pay — check the current price before buying. Figures compare each firm's standard 2-step $100,000 evaluation; 1-step and promotional variants differ. Fees are shown in the currency each firm lists."}
        </p>
      </Section>

      <Section eyebrow="Firm by firm" title="Explore Each Firm" band>
        <div className="grid gap-5 sm:grid-cols-2">
          {rows.map(({ firm, entity }) => {
            const linked = entity && isSeoWorthy(entity);
            return (
              <div
                key={firm.name}
                className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-white">{firm.name}</h3>
                  {entity ? <VerdictBadge verdict={entity.verdict} /> : null}
                </div>
                {entity ? <ScoreBar entity={entity} className="mt-3" /> : null}
                <p className="mt-3 text-[15px] leading-7 text-slate-400">{FIRM_BLURBS[firm.name]}</p>
                {linked ? (
                  <Link
                    href={entityPath(entity)}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    View the {firm.name} verification record
                  </Link>
                ) : (
                  <Link
                    href={`/compare/prop-firms?q=${encodeURIComponent(firm.name)}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    Find {firm.name} in the prop firm list
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="Guide" title="How to Choose a Forex Prop Firm"
        summary="Compare the profit target, the drawdown model and daily-loss basis, and the profit split before the headline fee." narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"The most useful forex prop firm comparison goes beyond the headline fee. Compare the profit target, then the drawdown model — whether the maximum loss is static or trailing, and whether it is calculated on balance or equity. Check the daily-loss basis, the profit split and how it scales, and the rules that apply once you reach the funded stage. A lower advertised price does not make a programme easier to pass or more likely to pay out. Once you understand the published terms, check the firm's independent verification record before you commit."}
        </p>
      </Section>

      <Section
        eyebrow="Drawdown"
        title="Drawdown Models Explained"
        summary="A static 10% floor never moves; a trailing limit rises with your balance, and an equity-based daily loss counts floating P&L."
        intro="How a firm measures your maximum loss matters as much as the headline percentage."
        narrow
        band
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Static vs Trailing Maximum Loss</h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">
              {"A static maximum loss is a fixed floor that does not move — all three firms compared here use a 10% static overall loss, so on a $100K account the floor sits at $90,000 regardless of how high the balance climbs. A trailing maximum loss rises with your balance or equity and does not fall back, so after a winning run it can sit much closer to your current balance. FTMO's one-step version, for example, uses a trailing overall limit rather than a static one."}
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Balance-Based vs Equity-Based Daily Loss</h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">
              {"The daily-loss limit can be measured off the day's starting balance or off live equity. FundingPips measures its 5% daily loss off the higher of the opening balance or current equity, which means floating (unrealised) profit and loss counts toward the threshold while positions are open. Knowing the basis changes how much room a position actually has intraday."}
            </p>
          </div>
          <p className="text-[15px] leading-7 text-slate-400">
            <Link href="/resources" className="font-medium text-[var(--vt-blue)] hover:underline">
              Read our guide to drawdown and risk management.
            </Link>
          </p>
        </div>
      </Section>

      <Section eyebrow="Costs" title="Evaluation Fees vs What You Actually Pay"
        summary="All three firms discount their list prices, so compare the live checkout price plus resets and add-ons." narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"The list price is rarely the price you pay. FTMO runs standing percentage discounts, The5ers sells the same $100K account size far more cheaply through promotional plans, and FundingPips has standing codes worth around 20% off. Beyond the headline fee, compare the full structure — the cost of resets, any add-ons and the funded-stage terms — and always check the live checkout price rather than the advertised list price before buying."}
        </p>
      </Section>

      <Section eyebrow="Targets" title="Profit Targets and 1-Step vs 2-Step"
        summary="A lower target is not automatically easier: the drawdown and daily-loss rules decide how hard a programme is to hold." narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"A two-step evaluation splits the profit target across two phases — for example 10% in Phase 1 then 5% in Phase 2. A one-step evaluation asks for the target in a single phase, but it usually pairs that with a tighter daily loss limit or a trailing drawdown to balance the shorter path. A lower overall target is not automatically easier: the drawdown model and daily-loss rules can make a lower-target programme harder to hold than a higher-target one with more generous risk limits."}
        </p>
      </Section>

      <Section eyebrow="Splits" title="Profit Splits and Scaling"
        summary="Splits start around 80% and scale differently at each firm, so read the scaling conditions in the funded-stage agreement." narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Funded splits and the way they scale differ between firms. FTMO starts at 80% and scales toward 90%; The5ers starts at 80% and scales up to 100% through its scaling plan; FundingPips pays roughly 60% to 90% depending on payout cadence. The headline split only tells part of the story — read the funded-stage agreement, including the scaling conditions and payout rules, rather than relying on the evaluation objectives alone."}
        </p>
      </Section>

      <Section eyebrow="Verification" title="Why Verify a Forex Prop Firm?" narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"A comparison explains how programmes differ. It does not establish whether a firm actually pays out or whether it is trustworthy. Verify Trading provides independent firm records designed to help traders research companies alongside their published terms. Explore the available evidence, read the firm's verification profile and understand the limits of any verification result before committing."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/methodology"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--vt-blue)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--vt-blue)]/90"
          >
            Explore Verification Methodology
          </Link>
          <Link
            href="/verify"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Verify a Prop Firm
          </Link>
        </div>
      </Section>

      <FaqSection items={FAQS} title="Forex prop firm questions, answered" schema={false} />

      <Section eyebrow="References" title="Official Sources" narrow>
        <ul className="space-y-2 text-[15px] leading-7 text-slate-300">
          {FIRMS.map((firm) => (
            <li key={firm.name}>
              <a
                href={firm.site}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="font-medium text-[var(--vt-blue)] hover:underline"
              >
                {firm.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Compare Forex Prop Firms With More Confidence"
        body="Choosing a forex evaluation means understanding the complete programme — the profit target, the drawdown model, the daily-loss basis and the funded-stage split — not just the headline fee. Compare the full programme, check the verification records and make a more informed decision."
        primary={{ label: "Compare All Prop Firms", href: "/compare/prop-firms" }}
        secondary={{ label: "Create Your Verify Trading Account", href: "/signup" }}
        location="forex_prop_firms"
      />
    </>
  );
}
