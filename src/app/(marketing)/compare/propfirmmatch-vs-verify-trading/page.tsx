import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs, CtaBand, FaqSection, PageHero, Section } from "@/components/marketing/primitives";
import { articleSchema, pageMetadata } from "@/lib/marketing/seo";
import { faqPageSchema } from "@/lib/seo/schema";

const path = "/compare/propfirmmatch-vs-verify-trading";
/** When the facts on this page were last verified against the cited sources. The sitemap and the TL;DR both read this. */
export const REVIEWED = "2026-11-01";
const REVIEWED_LABEL = `Reviewed ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(REVIEWED))}`;

const description =
  "PropFirmMatch vs Verify Trading compared: who pays each platform, what the October 2026 affiliate-tracking controversy established, and which model protects traders choosing a prop firm.";

export const metadata: Metadata = pageMetadata({
  title: "PropFirmMatch vs Verify Trading",
  description,
  path,
});

/*
 * Every claim about PropFirmMatch on this page is dated and sourced, and alleged
 * conduct stays "alleged" except where PropFirmMatch's own public statement is
 * quoted. Claims about verify.trading mirror the standing policy published on
 * /trust and /methodology. Keep it that way: on a verification brand, this page
 * is only as strong as its weakest claim.
 */

/** Primary external citation for the October 2026 events. */
const FM_ARTICLE =
  "https://www.financemagnates.com/forex/prop-firm-match-faces-affiliate-tracking-allegations-topstep-apex-tradeify-and-goat-funded-cut-ties/";

/** At-a-glance comparison rows, shown at the very top of the page. */
const GLANCE: Array<{ dimension: string; pfm: string; vt: string }> = [
  {
    dimension: "What it is",
    pfm: "Prop firm directory built around rankings, offers and discount codes",
    vt: "Independent verification platform for brokers, prop firms and trading educators",
  },
  {
    dimension: "Who pays the platform",
    pfm: "The listed prop firms, via affiliate commissions on challenge purchases",
    vt: "Traders, via Pro subscriptions — no income from any entity we rate",
  },
  {
    dimension: "Commissions from listed firms",
    pfm: "Yes — the core of the business model",
    vt: "No. Rated entities cannot be our affiliates, by policy",
  },
  {
    dimension: "Incentive when a firm looks risky",
    pfm: "A warning costs referral revenue from that firm",
    vt: "A warning costs nothing — verdicts aren't tied to firm payments",
  },
  {
    dimension: "How firms are assessed",
    pfm: "Rankings and community reviews shown alongside affiliate offers",
    vt: "Evidence-based verdicts with cited sources and a visible review date",
  },
  {
    dimension: "Affiliate-tracking record",
    pfm: "Oct 2026: admitted opening firms' sites through its own affiliate link on internal clicks — “This should not have happened”; several firms cut ties",
    vt: "Not applicable — no affiliate links to the firms we rate",
  },
  {
    dimension: "Discount codes",
    pfm: "Yes — central feature",
    vt: "No coupons; fees shown as list prices with a reviewed date",
  },
  {
    dimension: "Beyond the directory",
    pfm: "Deals, drops and firm news",
    vt: "Ask AI, market analysis, economic calendar, risk calculators, trading journal",
  },
];

const FAQS = [
  {
    q: "What happened with PropFirmMatch's affiliate tracking in October 2026?",
    a: "On 29 October 2026 a trader publicly alleged that clicking internal features on PropFirmMatch — firm profiles and promo-code buttons — triggered its affiliate links. The next day PropFirmMatch confirmed that clicks on a firm or code had opened the firm's site through its affiliate link, saying “This should not have happened. We take full responsibility for it.” Apex Trader Funding, Tradeify and Goat Funded Trader announced the same day that they had terminated their affiliate relationships, and Topstep was reported to be ending its relationship too. How many referrals or commissions were affected has not been established.",
  },
  {
    q: "Is PropFirmMatch legit?",
    a: "PropFirmMatch is a real, widely used prop firm directory. The relevant question for a trader is the business model: it earns affiliate commissions from the firms it lists, and in October 2026 it admitted that internal clicks had routed through its affiliate links, which it said should not have happened. Whatever you conclude from that, it is worth knowing who pays the platform whose rankings you rely on.",
  },
  {
    q: "Does verify.trading earn commissions from prop firms?",
    a: "No. verify.trading earns revenue from trader subscriptions. It takes no affiliate commissions, referral fees, discount-code revenue or paid placements from any broker, prop firm or educator it rates, and rated entities cannot join its affiliate programme. The full policy is on the trust and methodology pages.",
  },
  {
    q: "Is verify.trading free to use?",
    a: "The verification registers, broker and prop firm records, economic calendar preview and risk calculators are free. Pro adds the daily Intelligence brief, the full calendar, the trading journal with Challenge Mode, and higher Ask limits.",
  },
  {
    q: "Which should I use to choose a prop firm?",
    a: "Use whichever helps — they do different jobs. A deals directory is useful for seeing offers; an independent record is for checking the company behind the offer before you pay. If you only do one thing, read the firm's verification record and its cited sources before buying an evaluation.",
  },
];

/** Dated, sourced timeline of the October 2026 events. */
const TIMELINE: Array<{ date: string; what: string }> = [
  {
    date: "29 Oct 2026",
    what: "A trader known as Trader Kane alleges in a widely shared X post that clicking internal features on PropFirmMatch — firm profiles and promo-code buttons — triggered its affiliate links, redirecting the original tab through an affiliate URL while the intended page opened in a new tab.",
  },
  {
    date: "30 Oct 2026",
    what: "PropFirmMatch confirms the behaviour in a public statement: “Until yesterday, when someone clicked on a firm or a code on our site, a new tab would open the firm's site through our affiliate link … This should not have happened. We take full responsibility for it.”",
  },
  {
    date: "30 Oct 2026",
    what: "Apex Trader Funding, Tradeify and Goat Funded Trader announce they have terminated their affiliate relationships with PropFirmMatch, effective immediately. Tradeify says referrals to its site “broke our affiliate terms”. Topstep is reported to be ending its relationship as well.",
  },
];

function ExternalCite({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--vt-blue)] hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

export default function PropFirmMatchVsVerifyTradingPage() {
  return (
    <>
      <Breadcrumbs
        crumbs={[
          { name: "Compare", path: "/verify/prop-firms" },
          { name: "PropFirmMatch vs Verify Trading", path },
        ]}
      />
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={articleSchema({
          headline: "PropFirmMatch vs Verify Trading: Which Should Traders Trust?",
          description,
          path,
          datePublished: REVIEWED,
          articleType: "Article",
        })}
      />

      <PageHero
        eyebrow="Compare"
        title="PropFirmMatch vs Verify Trading: Which Should Traders Trust?"
        lede="Both help traders pick a prop firm — but they are paid by different people, and that changes everything downstream. Here is the factual comparison, including what the October 2026 affiliate-tracking controversy did and did not establish."
        tldr={[
          "PropFirmMatch is paid by the prop firms it lists, through affiliate commissions on challenge purchases. verify.trading is paid by traders, through subscriptions, and takes no money from any firm it rates.",
          "In October 2026 PropFirmMatch admitted that clicking a firm or promo code on its site had opened the firm's site through its own affiliate link — “This should not have happened”. Apex, Tradeify and Goat Funded Trader cut ties; Topstep was reported to follow.",
          "verify.trading publishes evidence-based verdicts with cited sources and review dates, plus Ask AI, risk calculators and a trading journal — and no coupon codes.",
          "Use a deals directory to see offers. Use an independent record to check the company before you pay.",
        ]}
        tldrNote={REVIEWED_LABEL}
        primary={{ label: "Check a prop firm's record", href: "/verify/prop-firms" }}
        secondary={{ label: "Read our methodology", href: "/methodology" }}
        location="propfirmmatch_vs_verify_trading"
      />

      <Section
        eyebrow="At a glance"
        title="PropFirmMatch vs Verify Trading"
        intro="The side-by-side facts. The deepest difference is the first money row: who pays the platform decides whose interest it serves."
      >
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-[var(--vt-muted)]">
                <th scope="col" className="px-4 py-3 font-semibold">Dimension</th>
                <th scope="col" className="px-4 py-3 font-semibold">PropFirmMatch</th>
                <th scope="col" className="px-4 py-3 font-semibold text-white">verify.trading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {GLANCE.map((row) => (
                <tr key={row.dimension} className="align-top text-slate-300">
                  <td className="px-4 py-4 font-medium text-white">{row.dimension}</td>
                  <td className="px-4 py-4">{row.pfm}</td>
                  <td className="px-4 py-4 text-slate-200">{row.vt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          Facts about PropFirmMatch reflect its publicly described business model and its own October 2026 statement, cited below. Facts about
          verify.trading reflect the standing policy published on{" "}
          <Link href="/trust" className="text-[var(--vt-blue)] hover:underline">Trust &amp; independence</Link> and{" "}
          <Link href="/methodology" className="text-[var(--vt-blue)] hover:underline">Methodology</Link>. {REVIEWED_LABEL}.
        </p>
      </Section>

      <Section
        eyebrow="Business model"
        title="Two Models, Two Masters"
        summary="PropFirmMatch earns when a trader buys a challenge through its links, so the firms it ranks are its customers. verify.trading earns from trader subscriptions, so the trader is the customer."
        narrow
        band
      >
        <div className="space-y-4 text-[15px] leading-7 text-slate-300">
          <p>
            {"PropFirmMatch is an affiliate directory: it earns commissions from prop firm challenge purchases made through its affiliate links and promotional codes. That model funds a genuinely useful catalogue of offers — and it also means the platform's revenue comes from the firms it ranks. When a listed firm looks risky, publishing a warning has a direct cost: the referral revenue from that firm."}
          </p>
          <p>
            {"verify.trading is funded the other way around. Revenue comes from trader subscriptions; we take no affiliate commissions, referral fees, discount-code revenue or paid placements from any broker, prop firm or educator we rate, and rated entities cannot join our affiliate programme. A verdict can say "}
            <em>Avoid</em>
            {" without costing us a penny, because the firm was never paying us."}
          </p>
          <p>
            {"Neither model is illegal, and affiliate directories can be useful. But when the job is deciding where to send your money, it is worth knowing which side of the table the platform sits on."}
          </p>
        </div>
      </Section>

      <Section
        eyebrow="October 2026"
        title="The Affiliate-Tracking Controversy, With Sources"
        intro="What was alleged, what PropFirmMatch itself confirmed, and what remains unestablished — with dates and citations, the same way we write every record."
        narrow
      >
        <ol className="space-y-5">
          {TIMELINE.map((item) => (
            <li key={item.what} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
              <span className="shrink-0 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--vt-coral)]">{item.date}</span>
              <p className="text-[15px] leading-7 text-slate-300">{item.what}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-300">
          <p>
            {"Reporting by "}
            <ExternalCite href={FM_ARTICLE}>Finance Magnates (30 October 2026)</ExternalCite>
            {" describes the alleged mechanism: the original browser tab was reportedly redirected through an affiliate link to the prop firm's website while the intended page opened in a new tab — meaning PropFirmMatch could be credited with sales it didn't send, or with sales another affiliate sent. PropFirmMatch's own affiliate terms prohibit forced cookies and hidden redirects."}
          </p>
          <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-7 text-slate-400">
            {"To be fair about the limits of the record: PropFirmMatch apologised, said it had reached out to partners to reconcile inaccuracies, and the behaviour was reported disabled by 30 October. How many referrals were affected, how much commission was involved, and whether it was intentional have "}
            <strong className="font-semibold text-slate-300">not</strong>
            {" been established publicly. We hold this page to the same standard as our verification records: dated claims, cited sources, and no conclusions the evidence doesn't support."}
          </p>
          <p>
            {"The structural point stands regardless of intent: an affiliate-funded directory sits between traders and the firms that pay it. The October 2026 episode is simply the clearest public illustration to date of why that position deserves scrutiny — and why we built verify.trading without it."}
          </p>
        </div>
      </Section>

      <Section
        eyebrow="Credit where due"
        title="Where PropFirmMatch Is Genuinely Useful"
        summary="A large, frequently updated catalogue of prop firm offers and discount codes — useful for seeing what deals exist, once you've verified the firm."
        narrow
        band
      >
        <p className="text-[15px] leading-7 text-slate-300">
          {"An honest comparison cuts both ways. PropFirmMatch maintains one of the largest catalogues of prop firm offers, discounts and drops, updated frequently, and many traders find deals there they would not have seen otherwise. If a discount code saves you money on a firm you have already verified independently, use it. Our argument is not that deal directories are useless — it is that a platform paid by the firms it ranks cannot also be your independent check on those firms. Do the verification first, then shop."}
        </p>
      </Section>

      <Section
        eyebrow="Why verify.trading"
        title="What You Get on the Trader's Side of the Table"
        intro="Built for the decision that matters most: whether the company behind the offer deserves your money."
      >
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {[
            {
              title: "Evidence-based verdicts",
              body: "Every broker and prop firm record shows its verdict, the sources behind it and the date it was last reviewed. Records come from regulators and primary sources, not marketing copy, and a record cannot be bought, improved or removed by its subject.",
              href: "/verify/prop-firms",
              label: "Browse prop firm records",
            },
            {
              title: "No commissions from rated firms",
              body: "Revenue comes from trader subscriptions. No affiliate commissions, referral fees, discount-code revenue or paid placements from any entity we rate — and rated entities cannot be our affiliates.",
              href: "/trust",
              label: "Read the independence policy",
            },
            {
              title: "Ask AI, grounded in the records",
              body: "Ask about any broker, prop firm, setup or market and get a sourced answer in seconds — including firms too new or too small to have a full record yet.",
              href: "/ask",
              label: "Ask about a firm",
            },
            {
              title: "The rest of the toolkit",
              body: "Markets and the daily Intelligence brief, the Economic Calendar, free risk calculators, and a trading journal with Challenge Mode for prop firm evaluations.",
              href: "/how-it-works",
              label: "See how it works",
            },
          ].map((card) => (
            <div key={card.title} className="flex flex-col rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.09),rgba(255,255,255,0.015)_55%)] p-5 sm:p-6">
              <h3 className="text-lg font-semibold tracking-tight text-white">{card.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-slate-400">{card.body}</p>
              <Link href={card.href} className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-slate-300 transition-colors hover:text-white">
                {card.label}
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <FaqSection items={FAQS} title="PropFirmMatch vs Verify Trading, answered" schema={false} />

      <CtaBand
        title="Verify the Firm Before You Buy the Deal"
        body="Discounts change weekly; the company behind them is what decides whether you ever see a payout. Check the independent record, read its sources, then decide — on evidence, not on a ranking the firm paid for."
        primary={{ label: "Check a prop firm now", href: "/verify/prop-firms" }}
        secondary={{ label: "How we verify", href: "/methodology" }}
        location="propfirmmatch_vs_verify_trading"
      />
    </>
  );
}
