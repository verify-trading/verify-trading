import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/seo/json-ld";
import { ScoreBar, VerdictBadge, scoreLabel } from "@/components/marketing/entity-ui";
import { Breadcrumbs, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { entityPath, isSeoWorthy } from "@/lib/compare/insights";
import { getPublicEntities, type PublicEntity } from "@/lib/compare/entities";
import { pageMetadata } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";

const path = "/compare/futures-prop-firms";
const description =
  "Compare futures prop firms by evaluation fees, profit targets, drawdown limits and trading rules. Explore Topstep, Earn2Trade, Bulenox and more.";

export const metadata: Metadata = pageMetadata({
  title: "Futures Prop Firms Compared: Fees, Rules & Drawdown",
  description,
  path,
});

/** The five named futures firms, in the order they appear on the page, with their programme row data. */
const FIRMS: Array<{
  name: string;
  programme: string;
  fee: string;
  profitTarget: string;
  drawdown: string;
  site: string;
}> = [
  {
    name: "Topstep",
    programme: "$50K Trading Combine — Standard Path",
    fee: "$49/month",
    profitTarget: "$3,000",
    drawdown: "$2,000 EOD trailing",
    site: "https://www.topstep.com",
  },
  {
    name: "Earn2Trade",
    programme: "$50K Gauntlet Mini",
    fee: "From $170/month",
    profitTarget: "$3,000",
    drawdown: "$2,000 EOD",
    site: "https://www.earn2trade.com",
  },
  {
    name: "Bulenox",
    programme: "$50K Momentum — EOD Option",
    fee: "$143 one-time (list price — frequently discounted)",
    profitTarget: "$3,000",
    drawdown: "$2,250 EOD",
    site: "https://www.bulenox.com",
  },
  {
    name: "TradeDay",
    programme: "$50K Intraday Evaluation",
    fee: "$131/month (standard listed price)",
    profitTarget: "$3,000",
    drawdown: "$2,000 intraday trailing",
    site: "https://www.tradeday.com",
  },
  {
    name: "OneUp Trader",
    programme: "$50K Evaluation",
    fee: "$75/month",
    profitTarget: "$3,000",
    drawdown: "$2,500 trailing",
    site: "https://www.oneuptrader.com",
  },
];

const FIRM_BLURBS: Record<string, string> = {
  Topstep:
    "Topstep's $50K Trading Combine has a $3,000 profit target and a $2,000 Maximum Loss Limit. Its Standard Path costs $49 per month, with a separate $149 activation fee when an Express Funded Account is earned. The alternative No Activation Fee Path has a higher monthly price.",
  Earn2Trade:
    "Earn2Trade's $50K Gauntlet Mini lists a $3,000 profit goal, $2,000 end-of-day drawdown, $1,100 daily loss limit and a 30% consistency requirement. Its published starting evaluation price is $170 per month.",
  Bulenox:
    "Bulenox offers different Momentum drawdown configurations. The $50K EOD option lists a $3,000 profit target, $2,250 maximum drawdown, $1,200 daily loss limit and a $143 one-time list fee. Bulenox frequently discounts this price heavily, so verify the current promotional price before purchasing. These figures refer specifically to the EOD option.",
  TradeDay:
    "TradeDay's $50K Intraday evaluation lists a $3,000 profit target, $2,000 intraday trailing drawdown, 30% consistency requirement and a minimum of five trading days. Its published standard price is $131 per month, although promotional pricing may be available.",
  "OneUp Trader":
    "OneUp Trader's $50K Evaluation lists a $3,000 profit target, $2,500 trailing drawdown, a maximum of six contracts and a $75 monthly evaluation fee. Its standard evaluation information specifies a minimum of ten trading days.",
};

const FAQS = [
  {
    q: "What are futures prop firms?",
    a: "Futures prop firms offer evaluation programmes and trading arrangements focused on futures markets. Retail programmes may involve simulated trading, with different conditions governing progression and rewards.",
  },
  {
    q: "Which futures prop firm has the lowest evaluation fee?",
    a: "Among the specific $50K programmes listed in this comparison, Topstep's Standard Path has the lowest published initial monthly price at $49. However, its activation fee and other conditions must also be considered.",
  },
  {
    q: "What is the difference between intraday and EOD drawdown?",
    a: "Intraday drawdown calculations can respond to account performance during a session, while EOD models use specified end-of-day values to update the threshold. The exact rules depend on the provider.",
  },
  {
    q: "Do futures prop firms have consistency rules?",
    a: "Many do. Topstep, Earn2Trade and TradeDay publish consistency requirements for the programmes compared on this page.",
  },
  {
    q: "Does passing a futures evaluation guarantee a payout?",
    a: "No. Payout eligibility depends on the funded-stage agreement and the trader meeting all applicable requirements.",
  },
  {
    q: "How can I check a futures prop firm before joining?",
    a: "Review its official programme terms, legal information and independent verification record. Verify Trading provides individual firm profiles for further research.",
  },
];

/** Case-insensitive name match against the public prop-firm records. */
function matchEntity(entities: PublicEntity[], name: string): PublicEntity | undefined {
  const target = name.toLowerCase();
  return entities.find((e) => e.name.toLowerCase() === target);
}

export default async function FuturesPropFirmsPage() {
  const propFirms = await getPublicEntities("propfirm");
  const rows = FIRMS.map((firm) => ({ firm, entity: matchEntity(propFirms, firm.name) }));

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: "Compare", path: "/compare/prop-firms" },
          { name: "Futures Prop Firms", path },
        ]}
      />
      <JsonLd data={faqPageSchema(FAQS)} />

      <PageHero
        eyebrow="Compare"
        title="Compare Futures Prop Firms: Fees, Rules & Drawdown"
        lede="Futures prop firms offer traders different ways to qualify for funded trading arrangements, but their evaluation fees, profit targets, drawdown limits and payout rules are not the same. A lower entry fee does not necessarily mean a better programme — the way a firm calculates drawdown, applies consistency requirements or charges for account activation can have a greater impact than the advertised account size. Compare futures prop firms using specific programme details, then explore their individual verification records on Verify Trading before making a decision."
        primary={{ label: "Compare Futures Prop Firms", href: "/compare/prop-firms" }}
        secondary={{ label: "Verify a Prop Firm", href: "/verify" }}
        location="futures_prop_firms"
      />

      <Section
        eyebrow="Comparison"
        title="Futures Prop Firm Comparison Table"
        intro="The table below compares selected $50,000 futures evaluation programmes using published programme terms."
      >
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[var(--vt-muted)]">
                <th scope="col" className="px-4 py-3 font-semibold">Firm</th>
                <th scope="col" className="px-4 py-3 font-semibold">Programme</th>
                <th scope="col" className="px-4 py-3 font-semibold">Published Fee</th>
                <th scope="col" className="px-4 py-3 font-semibold">Profit Target</th>
                <th scope="col" className="px-4 py-3 font-semibold">Drawdown Limit</th>
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
                    <td className="px-4 py-4">{firm.programme}</td>
                    <td className="px-4 py-4">{firm.fee}</td>
                    <td className="px-4 py-4">{firm.profitTarget}</td>
                    <td className="px-4 py-4">{firm.drawdown}</td>
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
          Data reviewed: October 20, 2026. Prices and programme terms may change. The table uses named evaluation configurations rather than combining rules from different account types. Fees are shown in USD, and promotional offers may differ from the listed prices — Bulenox in particular runs frequent, heavy discounts, so its list price is rarely the amount paid.
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
                    href="/compare/prop-firms"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    Browse prop firm records
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section eyebrow="Guide" title="How to Choose a Futures Prop Firm" narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          The most useful futures prop firm comparison goes beyond the account size and headline evaluation price. Start with the profit target. In the programmes compared above, the $50,000 evaluations each list a $3,000 target — however, the risk limits and other qualification requirements differ. Next, compare the drawdown model. An intraday trailing threshold can respond to account performance differently from an end-of-day threshold; this distinction matters when a trader holds positions through market fluctuations. Also review consistency rules, minimum trading days, contract limits and any activation or reset fees. Finally, investigate the company itself — published evaluation terms explain the programme, while independent verification records provide another layer of information about the firm behind it.
        </p>
      </Section>

      <Section
        eyebrow="Drawdown"
        title="Futures Prop Firm Drawdown Explained"
        intro="Drawdown determines how much an evaluation account can lose before breaching a programme's risk limits."
        narrow
        band
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">End-of-Day Trailing Drawdown</h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">
              {"An end-of-day trailing threshold adjusts according to the programme's specified closing-balance calculation. Topstep's standard Trading Combine uses a Maximum Loss Limit that trails upward as the end-of-day balance grows and does not move downward. The exact breach condition still applies during trading, including unrealised losses."}
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">Intraday Trailing Drawdown</h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">
              An intraday trailing model can respond to account performance during the trading session rather than waiting for the end-of-day calculation. TradeDay offers an intraday evaluation option with a $2,000 trailing drawdown on its $50K programme.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">End-of-Day Drawdown With Additional Limits</h3>
            <p className="mt-2 text-[15px] leading-7 text-slate-400">
              {"Bulenox's $50K Momentum EOD option combines a $2,250 EOD drawdown with a separate $1,200 daily loss limit. This illustrates why the maximum drawdown figure alone is not enough to evaluate a programme."}
            </p>
          </div>
          <p className="text-[15px] leading-7 text-slate-400">
            <Link href="/resources" className="font-medium text-[var(--vt-blue)] hover:underline">
              Read our guide to drawdown and risk management.
            </Link>
          </p>
        </div>
      </Section>

      <Section eyebrow="Costs" title="Evaluation Fees vs Total Programme Costs" narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"The advertised evaluation price is only one part of the cost comparison. Topstep's $50K Standard Path is listed at $49 per month, but earning an Express Funded Account through that path also involves a $149 activation fee. Earn2Trade and OneUp Trader publish monthly evaluation pricing for the programmes compared here. Bulenox lists a one-time fee for its Momentum programme (though it is frequently discounted), while TradeDay advertises both standard and promotional monthly prices. Traders should compare the full payment structure — including resets, activation charges and any recurring fees — rather than treating the lowest initial price as the lowest total cost."}
        </p>
      </Section>

      <Section eyebrow="Consistency" title="Futures Prop Firm Consistency Rules" narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Consistency requirements can limit how much of a trader's total profit may come from a single trading day. Topstep's Trading Combine applies a 55% consistency rule: your best single trading day must stay at or below 55% of the profit target, and Topstep treats it as a hard line with no rounding. At the funded stage, the Express Funded Account's consistency payout path caps your best day at 40% of total net profit, with a three-day minimum. Earn2Trade's $50K Gauntlet Mini lists a 30% consistency requirement. TradeDay's $50K Intraday evaluation also lists a 30% consistency requirement. These percentages belong to specific programmes and should not be assumed to apply to every account offered by those firms."}
        </p>
      </Section>

      <Section eyebrow="Payouts" title="Futures Prop Firm Payout Rules" narrow>
        <p className="text-[15px] leading-7 text-slate-300">
          {"Passing an evaluation and becoming eligible for a payout are separate milestones. Payout conditions can depend on the funded-stage account type, qualifying trading days, minimum request amounts, profit-sharing terms and withdrawal caps. For example, TradeDay's published funded-stage rules distinguish between its simulated and live funded arrangements, and Topstep also applies payout rules according to the type of funded account. Always review the funded-stage agreement, not just the evaluation objectives, before choosing a programme."}
        </p>
      </Section>

      <Section eyebrow="Verification" title="Why Verify a Futures Prop Firm?" narrow band>
        <p className="text-[15px] leading-7 text-slate-300">
          {"A comparison table explains how programmes differ. It does not establish whether a company is trustworthy or whether future payouts are guaranteed. Verify Trading provides independent firm records designed to help traders research companies alongside their published programme terms. Explore the available evidence, read the firm's verification profile and understand the limits of any verification result."}
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

      <FaqSection items={FAQS} title="Futures prop firm questions, answered" schema={false} />

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
        title="Compare Futures Prop Firms With More Confidence"
        body="Choosing a futures evaluation requires understanding the complete programme, not simply selecting the lowest fee or largest advertised account. Compare the rules, explore the verification records and make a more informed decision."
        primary={{ label: "Compare All Prop Firms", href: "/compare/prop-firms" }}
        secondary={{ label: "Create Your Verify Trading Account", href: "/signup" }}
        location="futures_prop_firms"
      />
    </>
  );
}
