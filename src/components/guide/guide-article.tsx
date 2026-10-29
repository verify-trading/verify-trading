import Image from "next/image";
import Link from "next/link";
import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { Breadcrumbs, CardGrid, CtaBand, FaqSection, LinkGrid, PageHero, Section, Steps } from "@/components/marketing/primitives";
import { links } from "@/lib/marketing/links";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

/**
 * /guide: the founder's "Complete Platform Guide + Prompt Library" deck, rebuilt as
 * server-rendered HTML. It used to be an image-only PDF drawn client-side, so crawlers
 * saw an empty page. The slides stay as supporting images; the PDF is still downloadable.
 *
 * Copy follows the live product (Ask limits, ITVE rules, verdict labels), not the deck,
 * where the two disagree.
 */

export const GUIDE_PATH = "/guide";
export const GUIDE_PDF_PATH = "/guide-pdf";
export const GUIDE_REVIEWED = "2026-10-29";
export const GUIDE_TITLE = "AI Trading Prompts and Platform Guide";
export const GUIDE_DESCRIPTION =
  "Copy-ready AI trading prompts to check brokers, prop firms, trades and gurus, plus a step-by-step verify.trading platform guide to get set up in a minute.";

export const GUIDE_SETUP_STEPS = [
  {
    title: "Visit verify.trading",
    body: "Open verify.trading in any browser. It works on mobile, tablet and desktop, so there is nothing to install.",
  },
  {
    title: "Create your free account",
    body: `Sign up in seconds with Google or a magic link sent to your inbox. No card is needed, and the free plan gives you ${FREE_DAILY_ASK_LIMIT} Ask chats every day with no expiry.`,
  },
  {
    title: "Open the Ask tab",
    body: "Ask is the single input for the whole platform. Type your question in plain English and it is routed to the right engine: BTS, ITVE or TTS.",
  },
  {
    title: "Type your first question",
    body: "Start with a broker or prop firm check, for example \"Is FTMO legitimate?\". You get a trust score and a plain verdict with the regulator record behind it.",
  },
  {
    title: "Upgrade when you are ready",
    body: "Pro raises the daily Ask limit and adds the Intelligence brief, the economic calendar, Journal with Challenge Mode, Mind coaching and the members-only community. Cancel anytime.",
  },
] as const;

export type PromptGroup = { id: string; title: string; engine: string; intro: string; prompts: string[]; tip: string };

export const PROMPT_GROUPS: PromptGroup[] = [
  {
    id: "broker-prompts",
    title: "Broker and prop firm verification prompts",
    engine: "BTS",
    intro: "Check before every deposit. Swap in the broker or prop firm name.",
    prompts: [
      "Is [broker name] a legitimate and regulated broker?",
      "Is [broker name] regulated by [regulator name]? Provide proof.",
      "What is the trust score of [broker name] and why?",
      "Show me real user reviews and complaints about [broker name].",
      "Does [broker name] have a history of payout issues?",
      "What trading conditions does [broker name] offer? Include spreads, leverage, fees.",
      "How long has [broker name] been in business?",
      "Is it safe to deposit money with [broker name]? Why or why not?",
    ],
    tip: "Always check before the first deposit. After is too late.",
  },
  {
    id: "trade-prompts",
    title: "Trade verification prompts",
    engine: "ITVE",
    intro: "Include your own entry, stop loss and target. ITVE scores the trade you submit and never invents levels for you.",
    prompts: [
      "Validate this trade idea: [instrument], Long/Short, Entry: [price], SL: [price], TP: [price].",
      "Is this a high-probability trade setup? [instrument], [entry], [SL], [TP], [timeframe].",
      "Check the risk-to-reward and edge: [instrument], Entry: [price], SL: [price], TP: [price].",
      "Identify key invalidation levels for this trade: [instrument], Long/Short, [entry], [SL], [TP].",
      "Confirm if my stop loss placement is optimal: [instrument], [entry], SL: [price], TP: [price].",
      "Analyze market structure and confluence for this trade: [instrument], [entry], [SL], [TP].",
      "Provide improvements to increase the probability of this setup: [instrument], [entry], [SL], [TP].",
    ],
    tip: "ITVE scores out of 100: 80 and above is High Probability, 60 to 79 is proceed with caution, below 60 is a negative verdict.",
  },
  {
    id: "brief-prompts",
    title: "Pre-session market brief prompts",
    engine: "Market brief",
    intro: "Send these before the session opens to get context, not trade calls.",
    prompts: [
      "Brief me on today's key market events and catalysts.",
      "What are the top 3 things that can move the markets today?",
      "Provide a pre-market overview for [Forex / Indices / Commodities / Crypto].",
      "What market sentiment are we seeing this morning and why?",
      "Key levels to watch today for [instrument / market].",
      "What are the risks to watch out for in today's session?",
      "Give me the momentum and volatility outlook for today.",
      "Brief me on Gold before London open today.",
    ],
    tip: "Pro members get the full Intelligence brief automatically before every session.",
  },
  {
    id: "sizing-prompts",
    title: "Position sizing prompts",
    engine: "Calculators",
    intro: "Give account size, risk percentage and stop loss in pips for a personalised answer.",
    prompts: [
      "Calculate my position size. Account: [amount], Risk: [x]%, SL: [x] pips.",
      "How many lots should I trade? Account: [amount], Risk: [x]%, SL: [x] pips.",
      "What is my monetary risk? Account: [amount], Risk: [x]%, SL: [x] pips.",
      "If I want to risk [amount], what lot size should I use? SL: [x] pips.",
      "If I reduce my SL to [x] pips, how does my lot size change? Risk: [x]%.",
      "Calculate position size for [instrument]. Account: [amount], Risk: [x]%, SL: [x] pips.",
    ],
    tip: "All three inputs (account, risk and stop pips) produce a personalised answer.",
  },
  {
    id: "guru-prompts",
    title: "Guru and signal group verification prompts",
    engine: "TTS",
    intro: "Check before you follow or pay anyone selling signals, courses or mentoring.",
    prompts: [
      "Is [guru / signal name] legitimate and trustworthy?",
      "Does [guru / signal name] have a verified track record?",
      "Is [guru / signal name] regulated by the FCA or any authority?",
      "Does [guru / signal name] earn broker referral income?",
      "What is the real performance of [guru / signal name]? Show proof.",
      "Are there complaints or negative feedback about [guru / signal name]?",
      "Should I follow or pay [guru / signal name]? Yes or No and why.",
    ],
    tip: "TTS checks regulatory status, broker referral income and track record on every query.",
  },
  {
    id: "mindset-prompts",
    title: "Trading psychology prompts",
    engine: "Mind",
    intro: "Use these before a session or after a loss to keep emotion out of your sizing.",
    prompts: [
      "How am I feeling right now and how should that impact my trading today?",
      "Should I trade, reduce size, or stand aside? Give me a clear answer and why.",
      "What biases are most likely to affect me today?",
      "Am I trying to prove something or follow my plan?",
      "How can I protect my capital and mindset if I face a losing streak?",
    ],
    tip: "Write to verify.trading the way you would message a trader you trust completely.",
  },
];

type Slide = { src: string; alt: string };

const SLIDES = {
  cover: { src: "/guide/platform-guide-cover.webp", alt: "verify.trading platform guide and prompt library cover, showing the Ask app on a phone" },
  platform: { src: "/guide/specialist-intelligence-platform.webp", alt: "verify.trading Ask workspace on a laptop with the six core jobs: check a broker, verify a trade, market brief, position size, verify a guru, plan your account" },
  engines: { src: "/guide/bts-itve-tts-engines.webp", alt: "The three verify.trading engines: BTS Broker Trust Score, ITVE trade verification and TTS trader trust score" },
  setup: { src: "/guide/five-step-setup.webp", alt: "Five steps to get started on verify.trading, from visiting the site to your first broker check" },
  routing: { src: "/guide/ask-tab-routing.webp", alt: "How the verify.trading Ask tab routes a question to BTS, ITVE, TTS, the market brief, calculators or projections" },
  brokerPrompts: { src: "/guide/broker-verification-prompts.webp", alt: "AI trading prompts for broker and prop firm verification with the BTS engine" },
  tradePrompts: { src: "/guide/trade-verification-and-market-brief-prompts.webp", alt: "AI trading prompts for ITVE trade verification and pre-session market briefs" },
  sizingPrompts: { src: "/guide/position-size-and-guru-check-prompts.webp", alt: "Position sizing prompts and guru and signal group verification prompts for TTS" },
  powerPrompts: { src: "/guide/power-user-prompts.webp", alt: "Power user prompts that combine broker, trade and guru checks in one question" },
  intelligence: { src: "/guide/market-intelligence-economic-calendar.webp", alt: "verify.trading Market Intelligence pre-session brief and economic calendar on mobile" },
  journal: { src: "/guide/trading-journal.webp", alt: "verify.trading trading journal showing logged trades, verdicts and monthly stats" },
  mind: { src: "/guide/psychological-ai.webp", alt: "verify.trading psychological AI: emotional state check, post-loss management, overconfidence detection and session readiness" },
  community: { src: "/guide/mentorship-and-community.webp", alt: "verify.trading Pro mentorship sessions and private trader community on mobile" },
} satisfies Record<string, Slide>;

/** One deck slide as a supporting figure. The section text carries the content; the slide illustrates it. */
function SlideFigure({ slide, priority = false, className }: { slide: Slide; priority?: boolean; className?: string }) {
  return (
    <figure className={className ?? "mx-auto w-full max-w-sm"}>
      <Image
        src={slide.src}
        alt={slide.alt}
        width={800}
        height={1200}
        sizes="(min-width: 1024px) 384px, 90vw"
        priority={priority}
        className="h-auto w-full rounded-2xl border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
      />
    </figure>
  );
}

/** Text left, slide right on desktop; stacked on mobile. */
function WithSlide({ slide, children }: { slide: Slide; children: ReactNode }) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
      <div className="min-w-0">{children}</div>
      <SlideFigure slide={slide} />
    </div>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-2xl space-y-4 text-[15px] leading-7 text-slate-300 [&_a]:text-[var(--vt-blue)] [&_a:hover]:underline">{children}</div>;
}

function PromptList({ group }: { group: PromptGroup }) {
  return (
    <div id={group.id} className="scroll-mt-20 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight text-white">{group.title}</h3>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--vt-coral)]">{group.engine}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{group.intro}</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-slate-200 marker:text-[var(--vt-coral)]/70">
        {group.prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="mt-4 text-sm font-medium leading-6 text-[var(--vt-blue)]">{group.tip}</p>
    </div>
  );
}

export const GUIDE_FAQS = [
  {
    q: "Do the prompts need special syntax?",
    a: "No. Replace the text in [brackets] with your own details and send it in plain English. Ask works out which engine should answer.",
  },
  {
    q: "Will verify.trading give me trades to take?",
    a: "No. ITVE scores the trade idea you submit, using your own entry, stop loss and target, and never invents levels. Briefs are market context. The decision is always yours.",
  },
  {
    q: "Can I download this guide?",
    a: "Yes. The full guide with every slide is available as a PDF from the download link on this page.",
  },
  {
    q: "Which prompt should I start with?",
    a: "A broker or prop firm check, before your first deposit. It is the fastest way to see how a verdict and its sources look.",
  },
];

export function GuideArticle() {
  return (
    <>
      <Breadcrumbs crumbs={[{ name: "Platform guide", path: GUIDE_PATH }]} />
      <PageHero
        eyebrow="Platform guide"
        title={
          <>
            AI Trading Prompts
            <br />
            <span className="text-[var(--vt-coral)]">+ verify.trading Platform Guide</span>
          </>
        }
        lede="Copy-ready AI trading prompts for checking a broker, a prop firm, a trade or a guru, plus everything you need to get real value from verify.trading: how to set up and what the three engines do."
        primary={{ label: "Start free", href: "/signup", event: "signup" }}
        secondary={{ label: "Download the PDF", href: GUIDE_PDF_PATH, event: "guide" }}
        tldr={[
          `Free account in under a minute, ${FREE_DAILY_ASK_LIMIT} Ask chats a day, no card needed.`,
          "Ask routes every question to the right engine: BTS for brokers and prop firms, ITVE for trades, TTS for gurus and signal groups.",
          "Copy an AI trading prompt below, replace the [brackets] with your details, and send it in plain English.",
          "Pro adds the daily Intelligence brief, economic calendar, Journal, Mind coaching and the community.",
        ]}
        tldrNote="Updated 29 October 2026"
        visual={<SlideFigure slide={SLIDES.cover} priority />}
        location="guide"
      />

      <Section id="why" eyebrow="The problem" title="Why traders need a verification step">
        <WithSlide slide={SLIDES.platform}>
          <Prose>
            <p>
              Most retail traders do not lose because they lack intelligence. They lose because they make decisions
              without the right information at the right moment. verify.trading was built to close that gap on the four
              mistakes that cost traders most.
            </p>
          </Prose>
          <div className="mt-8">
            <CardGrid
              cols={2}
              numbered
              items={[
                { title: "Depositing with an unverified broker", body: "Choosing a broker from search results and star ratings instead of the regulator record. A broker check takes seconds and should come before the first deposit." },
                { title: "Following unverified signal services", body: "Signal groups can show only their winning screenshots. Check the person's regulatory status, track record and broker referral income before you pay or follow." },
                { title: "Trading on instinct", body: "Professional traders run a pre-trade check on every idea. ITVE gives you that check: submit your entry, stop and target and get a score and verdict." },
                { title: "Trading without psychological structure", body: "Revenge trading, overtrading after a win and moving stops out of fear destroy more capital than bad strategies. Mind and Journal build the habit that stops it." },
              ]}
            />
          </div>
        </WithSlide>
      </Section>

      <Section id="engines" eyebrow="Proprietary technology" title="The three engines: BTS, ITVE and TTS" band>
        <WithSlide slide={SLIDES.engines}>
          <Prose>
            <p>
              verify.trading is a specialist platform, not a general chatbot. Behind the Ask tab sit three engines, each
              built for one layer of checking. You never pick one yourself: Ask reads your question and sends it to the
              right engine.
            </p>
          </Prose>
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">BTS: Broker Trust Score</h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-400">
                Checks a broker or prop firm against regulator records: authorisation status, warnings and restrictions,
                and entity details such as domain and contact information. The result is a trust score and a plain
                verdict, from Strongly Trusted to Avoid. Browse every rated name on the{" "}
                <Link href="/verify/brokers" className="text-[var(--vt-blue)] hover:underline">broker register</Link> and the{" "}
                <Link href="/verify/prop-firms" className="text-[var(--vt-blue)] hover:underline">prop firm register</Link>.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">ITVE: Institutional Trade Verification Engine</h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-400">
                Scores a trade idea you submit out of 100, weighing market structure, liquidity, candle pressure and your
                strategy rules, with risk-to-reward and stop placement as vetoes. It restates your exact entry, stop and
                target first and never invents levels. 80 and above is High Probability; below 60 is a negative verdict.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">TTS: Traders Trust Score</h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-400">
                Checks educators, gurus and signal services: regulatory status, whether they earn broker referral income,
                their track record, and whether published results look cherry-picked. Start from the{" "}
                <Link href="/verify/traders" className="text-[var(--vt-blue)] hover:underline">trader and educator checks</Link>.
              </p>
            </div>
          </div>
        </WithSlide>
      </Section>

      <Section id="get-started" eyebrow="Up and running in a minute" title="How to get started: five steps">
        <WithSlide slide={SLIDES.setup}>
          <Steps items={[...GUIDE_SETUP_STEPS]} />
        </WithSlide>
      </Section>

      <Section id="ask" eyebrow="Your intelligence engine" title="How the Ask tab routes your question" band>
        <WithSlide slide={SLIDES.routing}>
          <Prose>
            <p>
              Ask one question and the engines get to work. You do not need menus or forms: the way you phrase the
              question decides where it goes.
            </p>
          </Prose>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full max-w-2xl text-left text-[15px]">
              <caption className="sr-only">Which engine answers each type of question in Ask</caption>
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-2 pr-4 font-semibold">You ask about</th>
                  <th scope="col" className="py-2 font-semibold">Answered by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-slate-300">
                <tr><td className="py-2.5 pr-4">A broker or prop firm name, or &quot;is X safe?&quot;</td><td className="py-2.5">BTS</td></tr>
                <tr><td className="py-2.5 pr-4">A trade with entry, stop loss and target</td><td className="py-2.5">ITVE</td></tr>
                <tr><td className="py-2.5 pr-4">A guru or signal group name</td><td className="py-2.5">TTS</td></tr>
                <tr><td className="py-2.5 pr-4">&quot;Brief me on Gold today&quot;</td><td className="py-2.5">Market brief</td></tr>
                <tr><td className="py-2.5 pr-4">A lot size or risk question</td><td className="py-2.5">Calculators</td></tr>
                <tr><td className="py-2.5 pr-4">An account growth projection</td><td className="py-2.5">Projections</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-slate-400">
            Prefer to run the numbers yourself? The same maths is in the free{" "}
            <Link href="/tools" className="text-[var(--vt-blue)] hover:underline">trading calculators</Link>, including the{" "}
            <Link href="/tools/position-size-calculator" className="text-[var(--vt-blue)] hover:underline">position size calculator</Link>.
          </p>
        </WithSlide>
      </Section>

      <Section
        id="prompts"
        eyebrow="Prompt library"
        title="AI trading prompts: copy, replace, get your answer"
        intro="Replace all text in [brackets] with your own details. Natural language works; no special syntax is needed."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {PROMPT_GROUPS.map((g) => (
            <PromptList key={g.id} group={g} />
          ))}
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SlideFigure slide={SLIDES.brokerPrompts} className="w-full" />
          <SlideFigure slide={SLIDES.tradePrompts} className="w-full" />
          <SlideFigure slide={SLIDES.sizingPrompts} className="w-full" />
          <SlideFigure slide={SLIDES.powerPrompts} className="w-full" />
        </div>
        <h3 className="mt-10 text-lg font-semibold tracking-tight text-white">Power user prompts: combine checks in one question</h3>
        <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-[15px] leading-7 text-slate-200 marker:text-[var(--vt-coral)]/70">
          <li>Is [broker name] legitimate, regulated, and safe? Include trust score, proof, and real user reviews.</li>
          <li>Analyze this trade idea: [instrument], Long/Short, Entry: [price], SL: [price], TP: [price]. Include probability, risk-to-reward, key levels, and invalidation.</li>
          <li>Check [guru/signal name] for legitimacy, FCA status, track record, broker referral income, and real performance. Should I follow or pay?</li>
          <li>Verify [broker name] and compare it with [broker name]. Include trust score, regulation, fees, spreads, leverage, and user feedback.</li>
          <li>Is this a good time to trade [instrument]? Include market sentiment, catalysts and risks.</li>
        </ol>
      </Section>

      <Section id="pro" eyebrow="Pro features" title="What Pro adds" band>
        <div className="space-y-14">
          <WithSlide slide={SLIDES.intelligence}>
            <h3 className="text-xl font-semibold tracking-tight text-white">Market Intelligence and the economic calendar</h3>
            <Prose>
              <p className="mt-3">
                Two features that put you in front of the market before the session begins. The{" "}
                <Link href="/intelligence">Intelligence brief</Link> covers gold, oil and the major FX pairs with key levels,
                a session bias, flagged high-impact news and a one-line verdict to trade or stand aside. The{" "}
                <Link href="/economic-calendar">economic calendar</Link> shows the high-impact events ahead so you are not
                caught by a spike.
              </p>
              <p>A simple rule from the guide: avoid opening new positions in the minutes before a red-impact event. Wait for the spike, then trade the real move.</p>
            </Prose>
          </WithSlide>
          <WithSlide slide={SLIDES.journal}>
            <h3 className="text-xl font-semibold tracking-tight text-white">Trading journal</h3>
            <Prose>
              <p className="mt-3">
                Your edge comes from process, not luck. The <Link href="/journal">trading journal</Link> records each trade
                with its verdict and score, tracks your win rate against ITVE scores, and shows the high-quality setups
                you chose not to take, because discipline has a P&amp;L too. Challenge Mode keeps prop firm traders inside
                their account rules.
              </p>
            </Prose>
          </WithSlide>
          <WithSlide slide={SLIDES.mind}>
            <h3 className="text-xl font-semibold tracking-tight text-white">Mind: trading psychology</h3>
            <Prose>
              <p className="mt-3">
                <Link href="/mind">Mind</Link> helps you spot emotional risk before it reaches your account: an emotional
                state check before you trade, a structured reset after a loss to stop revenge trading, a flag for
                oversizing after a winning streak, and a short session-readiness check-in.
              </p>
            </Prose>
          </WithSlide>
          <WithSlide slide={SLIDES.community}>
            <h3 className="text-xl font-semibold tracking-tight text-white">Mentorship and community</h3>
            <Prose>
              <p className="mt-3">
                You do not have to do this alone. Pro includes access to mentorship sessions and a private community of
                verified traders sharing setups and weekly market discussion. See <Link href="/pricing">plans and pricing</Link> for
                the full list.
              </p>
            </Prose>
          </WithSlide>
        </div>
        <p className="mt-12 flex items-center gap-2 text-sm text-slate-400">
          <Download className="size-4" aria-hidden />
          <a href={GUIDE_PDF_PATH} className="text-[var(--vt-blue)] hover:underline">Download the complete guide as a PDF</a>
          , with every slide.
        </p>
      </Section>

      <FaqSection items={GUIDE_FAQS} title="Guide questions" intro="Quick answers about the guide and the prompt library." />

      <LinkGrid title="Keep learning" items={links("howItWorks", "verify", "tools")} />

      <CtaBand
        title="Serious traders don't guess. They verify."
        body={`Start free with ${FREE_DAILY_ASK_LIMIT} Ask chats a day and run your first broker check in under a minute.`}
        primary={{ label: "Start free", href: "/signup", event: "signup" }}
        secondary={{ label: "Open Ask", href: "/ask", event: "ask" }}
        location="guide"
      />
    </>
  );
}
