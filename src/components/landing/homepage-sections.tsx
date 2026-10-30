import Link from "next/link";
import { ArrowRight, Calendar, CalendarClock, FileCheck2, LineChart, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { CtaLink } from "@/components/marketing/cta-link";
import { SectionEyebrow } from "@/components/landing/section-primitives";
import { cn } from "@/lib/utils";

/*
 * Homepage body sections — the scannable, internally-linked story below the hero phone.
 * Everything here is server-rendered static HTML (so it is crawlable); the only client
 * island is CtaLink, which reports CTA clicks to analytics with a per-section `location`.
 *
 * All charts, conversations, records and journal entries are ILLUSTRATIVE examples.
 * Keep the "Example"/"Illustrative" labels — these are YMYL pages and the copy must not
 * read as advice or a prediction of results.
 */

const UP = "#22C55E";
const DOWN = "var(--vt-coral)";

/* ─── Small building blocks ─── */

/** Coral/blue pill label marking a preview as a non-live example. */
function ExampleTag({ children = "Illustrative example" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">
      <Sparkles className="size-3 text-[var(--vt-coral)]" aria-hidden />
      {children}
    </span>
  );
}

/** Supporting text link with a trailing arrow. */
function SupportingLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--vt-blue)] transition hover:text-white"
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Rounded preview surface used for every illustrative panel. */
function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(160deg,rgba(76,110,245,0.1),rgba(255,255,255,0.015)_60%)] p-4 shadow-[0_20px_60px_-30px_rgba(76,110,245,0.6)] sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * One homepage section: heading + paragraph + CTAs on one side, a preview panel on the other.
 * `flip` puts the visual on the left (desktop). `wide` gives Ask + Markets more visual room.
 */
function FeatureRow({
  id,
  icon: Icon,
  eyebrow,
  title,
  children,
  primary,
  secondary,
  visual,
  flip = false,
  wide = false,
}: {
  id: string;
  icon: typeof LineChart;
  eyebrow: string;
  title: string;
  children: ReactNode;
  primary: { label: string; href: string; event?: "ask" | "pricing" };
  secondary?: Array<{ label: string; href: string }>;
  visual: ReactNode;
  flip?: boolean;
  wide?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-12 sm:py-16">
      <div
        className={cn(
          "mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:gap-14",
          wide ? "lg:grid-cols-2" : "lg:grid-cols-[0.95fr_1.05fr]",
        )}
      >
        <div className={cn("min-w-0", flip && "lg:order-2")}>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--vt-blue)]/15 text-[#8fa5ff]">
              <Icon className="size-4" aria-hidden />
            </span>
            <SectionEyebrow>{eyebrow}</SectionEyebrow>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">{title}</h2>
          <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-300">{children}</div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>a]:w-full sm:[&>a]:w-auto">
            <CtaLink href={primary.href} event={primary.event} location={id}>
              {primary.label}
              <ArrowRight aria-hidden />
            </CtaLink>
          </div>
          {secondary?.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {secondary.map((s) => (
                <SupportingLink key={s.href} href={s.href}>
                  {s.label}
                </SupportingLink>
              ))}
            </div>
          ) : null}
        </div>
        <div className={cn("min-w-0", flip && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}

/* ─── Illustrative charts ─── */

/** Compact candlestick chart with a dashed level line. Decorative sample data. */
function CandleChart({ levelLabel }: { levelLabel?: string }) {
  // [x, openY, closeY, highY, lowY] in a 0–100 viewBox; lower y = higher price.
  const candles: Array<[number, number, number, number, number, boolean]> = [
    [6, 70, 58, 74, 54, true],
    [16, 58, 62, 66, 50, false],
    [26, 62, 48, 66, 44, true],
    [36, 48, 52, 56, 44, false],
    [46, 52, 40, 56, 34, true],
    [56, 40, 44, 50, 36, false],
    [66, 44, 32, 48, 28, true],
    [76, 32, 36, 42, 26, false],
    [86, 36, 26, 40, 22, true],
  ];
  return (
    <svg viewBox="0 0 100 90" className="h-40 w-full sm:h-48" role="img" aria-label="Illustrative price chart">
      <defs>
        <linearGradient id="hp-candle-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(76,110,245,0.18)" />
          <stop offset="100%" stopColor="rgba(76,110,245,0)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="90" fill="url(#hp-candle-fade)" />
      {/* dashed support/resistance level */}
      <line x1="0" y1="34" x2="100" y2="34" stroke="rgba(242,109,109,0.55)" strokeWidth="0.6" strokeDasharray="2 2" />
      {levelLabel ? (
        <text x="1.5" y="31.5" fill="rgba(242,109,109,0.9)" fontSize="4.2" fontWeight="700">
          {levelLabel}
        </text>
      ) : null}
      {candles.map(([x, o, c, h, l, up], i) => {
        const color = up ? UP : DOWN;
        const top = Math.min(o, c);
        const height = Math.max(Math.abs(c - o), 1.5);
        return (
          <g key={i}>
            <line x1={x} y1={h} x2={x} y2={l} stroke={color} strokeWidth="0.8" />
            <rect x={x - 3} y={top} width="6" height={height} rx="0.8" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Section visuals ─── */

function AskVisual() {
  const prompts = [
    "What supports or weakens this potential XAUUSD setup?",
    "Where are the support and resistance areas on this chart?",
    "What should I check before considering an entry?",
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1.05fr]">
      <Panel className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-white">XAU/USD · 4H</span>
          <ExampleTag>Example chart</ExampleTag>
        </div>
        <div className="mt-3">
          <CandleChart levelLabel="Resistance" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[var(--vt-muted)]">Illustrative price action. Not live data or advice.</p>
      </Panel>
      <Panel className="flex flex-col">
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((p) => (
            <span key={p} className="rounded-full border border-[rgba(76,110,245,0.25)] bg-[var(--vt-blue)]/10 px-2.5 py-1 text-[11px] leading-snug text-[#aab8e8]">
              {p}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--vt-blue)] px-3 py-2 text-[13px] leading-snug text-white">
            What supports or weakens this potential XAUUSD setup?
          </p>
          <div className="rounded-2xl rounded-bl-sm border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <MessageSquareText className="size-3.5 text-[var(--vt-coral)]" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Example response</span>
            </div>
            <p className="text-[13px] leading-6 text-slate-200">
              Price is holding above the recent higher low, which supports the idea — but it is stalling under resistance, so the setup is not confirmed. Before acting you would want to see how price reacts at that level and check the next high-impact release. This is an explanation of the reasoning, not a recommendation.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function MarketsVisual() {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-white">XAU/USD · Gold</span>
        <ExampleTag>Sample analysis</ExampleTag>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <CandleChart levelLabel="Key level" />
        </div>
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Context</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-200">Risk tone steady into the US session; the dollar and real yields are the drivers to watch.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Key levels", "Events to watch", "Drivers"].map((c) => (
              <span key={c} className="rounded-full bg-[var(--vt-blue)]/12 px-2 py-0.5 text-[10px] font-semibold text-[#8fa5ff]">{c}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Bring it into Ask</p>
        <p className="mt-1 text-[13px] leading-6 text-slate-200">“What could be driving gold’s movement, and what should I investigate next?”</p>
      </div>
      <p className="mt-3 text-[11px] text-[var(--vt-muted)]">Sample market context · for illustration · 28 Oct 2026, 13:30 UTC</p>
    </Panel>
  );
}

function CalendarVisual() {
  const events = [
    { time: "13:30", ccy: "USD", ev: "Core CPI m/m", imp: "High", forecast: "0.3%", dot: "bg-[var(--vt-coral)]" },
    { time: "13:30", ccy: "USD", ev: "Initial Jobless Claims", imp: "Medium", forecast: "221K", dot: "bg-[#F59E0B]" },
    { time: "15:00", ccy: "USD", ev: "Fed Chair Speaks", imp: "High", forecast: "—", dot: "bg-[var(--vt-coral)]" },
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-white">
          <Calendar className="size-3.5 text-[var(--vt-coral)]" aria-hidden /> Economic Calendar
        </span>
        <ExampleTag>Preview</ExampleTag>
      </div>
      <p className="mt-2 text-[11px] text-[var(--vt-muted)]">Times shown in UTC · timezone is adjustable in-app</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="grid grid-cols-[auto_auto_1fr_auto] gap-x-3 border-b border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--vt-muted)]">
          <span>Time</span>
          <span>Ccy</span>
          <span>Event</span>
          <span>Forecast</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {events.map((e) => (
            <div key={e.ev} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 px-3 py-2">
              <span className="font-mono text-[12px] tabular-nums text-white">{e.time}</span>
              <span className="font-mono text-[11px] font-semibold text-[#8fa5ff]">{e.ccy}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", e.dot)} aria-hidden />
                <span className="truncate text-[12px] text-slate-200">{e.ev}</span>
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--vt-muted)]">{e.forecast}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[13px] leading-6 text-slate-200">
          Researching gold? You can see which US releases land during your session and plan around them — the calendar shows what is scheduled, not how price will react.
        </p>
      </div>
    </Panel>
  );
}

function CalculatorVisual() {
  const inputs = [
    { k: "Account balance", v: "$10,000" },
    { k: "Risk per trade", v: "1%  ·  $100" },
    { k: "Stop distance", v: "20 pips" },
  ];
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-white">Position size · EUR/USD</span>
        <ExampleTag>Worked example</ExampleTag>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-2">
          {inputs.map((i) => (
            <div key={i.k} className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <span className="text-[12px] text-[var(--vt-muted)]">{i.k}</span>
              <span className="font-mono text-[12px] font-semibold text-white">{i.v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-[var(--vt-blue)]/30 bg-[var(--vt-blue)]/[0.08] p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Estimated size</p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">0.50 lot</p>
          <p className="mt-1 text-[11px] text-[var(--vt-muted)]">≈ $5 per pip</p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-slate-300">
        Keep the risk at $100 and widen the stop to 40 pips, and the position halves to <span className="font-semibold text-white">0.25 lot</span> — same risk, smaller size.
      </p>
      <p className="mt-2 text-[11px] text-[var(--vt-muted)]">Forex example. A planning estimate — allow for execution costs and your broker’s contract specifications.</p>
    </Panel>
  );
}

function VerifyVisual() {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-white">Directory record</span>
        <ExampleTag>Example record</ExampleTag>
      </div>
      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-white">Example Broker Ltd</p>
            <p className="text-[12px] text-[var(--vt-muted)]">Broker · reviewed 24 Oct 2026</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2.5 py-1 text-[11px] font-semibold text-[#5fd98a]">
            <ShieldCheck className="size-3.5" aria-hidden /> Registered · no warnings
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-[var(--vt-muted)]">Regulator</p>
            <p className="font-semibold text-white">FCA (United Kingdom)</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] px-3 py-2">
            <p className="text-[var(--vt-muted)]">Register status</p>
            <p className="font-semibold text-white">Authorised</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <FileCheck2 className="size-3.5 text-[#8fa5ff]" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--vt-muted)]">Sources</span>
          <span className="rounded-full bg-[var(--vt-blue)]/12 px-2 py-0.5 text-[11px] font-semibold text-[#8fa5ff]">Regulator register ↗</span>
          <span className="rounded-full bg-[var(--vt-blue)]/12 px-2 py-0.5 text-[11px] font-semibold text-[#8fa5ff]">Warning list ↗</span>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-6 text-slate-300">
        A verdict summarises the recorded evidence on the review date — it is not a guarantee. Brokers and prop firms are assessed on different criteria.
      </p>
    </Panel>
  );
}

// 0 = no trade, 1 = green day, 2 = red day
const JOURNAL_DAYS = [0, 1, 1, 2, 1, 0, 0, 1, 2, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 0, 0];

function JournalVisual() {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-white">
          <CalendarClock className="size-3.5 text-[var(--vt-coral)]" aria-hidden /> Trading Journal
        </span>
        <ExampleTag>Sample data</ExampleTag>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-[12px] font-semibold text-white">October</p>
          <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
            {JOURNAL_DAYS.map((d, i) => (
              <span
                key={i}
                className={cn(
                  "aspect-square rounded-[3px]",
                  d === 1 ? "bg-[#22C55E]/70" : d === 2 ? "bg-[var(--vt-coral)]/70" : "bg-white/[0.06]",
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-[var(--vt-muted)]">
            <span className="flex items-center gap-1"><span className="size-2 rounded-[2px] bg-[#22C55E]/70" /> Win</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-[2px] bg-[var(--vt-coral)]/70" /> Loss</span>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-white">Thu · EUR/USD</span>
              <span className="font-mono text-[12px] font-semibold text-[#5fd98a]">+$180</span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--vt-muted)]">Mood: focused 🙂</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-300">Lesson: waited for confirmation at the level instead of front-running it.</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Weekly insight</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-300">Your best days this week followed your plan; the red day broke your own stop rule.</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--vt-muted)]">Sample journal data. Import, Challenge mode and weekly insights are Pro features.</p>
    </Panel>
  );
}

/* ─── The homepage body ─── */

export function HomepageSections() {
  return (
    <div className="bg-[var(--vt-navy)]">
      {/* Intro / positioning paragraph, immediately below the phone */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2 text-center sm:px-6">
        <p className="text-balance text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
          verify.trading is a trading intelligence platform. Ask AI about your charts, read the markets and the daily brief, size your risk, and check a broker or prop firm before you deposit — then review every session as you learn. It all stays in one place, grounded in sourced records and clearly labelled examples.
        </p>
      </div>

      <div className="divide-y divide-white/[0.04]">
        <FeatureRow
          id="home_ask"
          icon={MessageSquareText}
          eyebrow="Ask"
          title="Ask AI About Your Trading Charts"
          wide
          primary={{ label: "Ask about your chart", href: "/ask", event: "ask" }}
          secondary={[{ label: "See how verify.trading works", href: "/how-it-works" }]}
          visual={<AskVisual />}
        >
          <p>
            Upload a trading chart and ask questions about the price action you see. Use Ask to explore trends, discuss a potential setup and understand unfamiliar trading concepts. Add the instrument, timeframe and your question to give the analysis more context.
          </p>
          <h3 className="pt-1 text-lg font-semibold tracking-tight text-white">Understand the Reasoning Behind the Analysis</h3>
          <p>
            Ask follow-up questions about chart patterns, market terminology and the assumptions behind an analysis. Build your understanding as you explore your own trading questions.
          </p>
        </FeatureRow>

        <FeatureRow
          id="home_markets"
          icon={LineChart}
          eyebrow="Markets & Intelligence"
          title="Explore Market Analysis and Insights"
          wide
          flip
          primary={{ label: "Explore Markets", href: "/markets" }}
          secondary={[{ label: "Preview the daily market brief", href: "/intelligence" }]}
          visual={<MarketsVisual />}
        >
          <p>
            Explore gold (XAUUSD), forex, indices and crypto through Markets. Review potential market drivers, key levels and upcoming events with the daily Intelligence brief, then bring your questions into Ask to explore the reasoning behind the analysis.
          </p>
          <p className="text-sm text-slate-400">
            Markets shows prices and context; the deeper daily analysis and key levels are part of Pro.
          </p>
        </FeatureRow>

        <FeatureRow
          id="home_calendar"
          icon={Calendar}
          eyebrow="Economic Calendar"
          title="Understand the News Moving Markets"
          primary={{ label: "View the Economic Calendar", href: "/economic-calendar" }}
          secondary={[{ label: "Explore the daily market brief", href: "/intelligence" }]}
          visual={<CalendarVisual />}
        >
          <p>
            Check upcoming inflation reports, employment releases and central bank decisions with the Economic Calendar. Review event times, impact levels and available forecast figures as part of your preparation. If you trade a prop firm account, compare upcoming releases with your firm’s current news-trading rules.
          </p>
          <p className="text-sm text-slate-400">
            The preview shows what’s scheduled; the full calendar and its filters are part of Pro.
          </p>
        </FeatureRow>

        <FeatureRow
          id="home_tools"
          icon={LineChart}
          eyebrow="Risk tools"
          title="Calculate Your Risk Before Trading"
          flip
          primary={{ label: "Use the free trading calculators", href: "/tools" }}
          secondary={[
            { label: "Position size calculator", href: "/tools/position-size-calculator" },
            { label: "Risk-to-reward calculator", href: "/tools/risk-reward-calculator" },
          ]}
          visual={<CalculatorVisual />}
        >
          <p>
            Estimate position size from your account balance, chosen risk percentage and stop distance. Compare your planned entry, stop and target with the risk-to-reward calculator, and explore pip value, margin and potential profit or loss through the free trading tools.
          </p>
          <p>
            Changing the stop distance changes the position size even when the risk amount stays the same — wider stop, smaller size.
          </p>
        </FeatureRow>

        <FeatureRow
          id="home_verify"
          icon={ShieldCheck}
          eyebrow="Verify"
          title="Check Brokers and Prop Firms"
          primary={{ label: "Check a broker or prop firm", href: "/verify" }}
          secondary={[{ label: "Read our verification methodology", href: "/methodology" }]}
          visual={<VerifyVisual />}
        >
          <p>
            Research a broker or prop firm before depositing money or buying an evaluation. Review the regulatory information, operating records and published terms available in verify.trading’s directory. Follow the cited sources and check the record’s review date to understand the evidence behind its assessment.
          </p>
          <p>
            Each verdict is a summary of recorded evidence with clear limits on what it establishes — brokers and prop firms are assessed on different criteria.
          </p>
        </FeatureRow>

        <FeatureRow
          id="home_journal"
          icon={CalendarClock}
          eyebrow="Journal"
          title="Review Your Trading Sessions"
          flip
          primary={{ label: "Explore the Trading Journal", href: "/journal" }}
          secondary={[{ label: "View Pro plans", href: "/pricing" }]}
          visual={<JournalVisual />}
        >
          <p>
            Keep your trading results, session notes and lessons together in the Trading Journal. Import closed trades from supported broker connections or CSV files, record your mood and review your sessions over time. Challenge mode also helps track progress against the targets and trading-day requirements you enter.
          </p>
          <p className="text-sm text-slate-400">
            Imported trades are journal data — not independently verified performance. Import, Challenge mode and weekly insights are Pro features.
          </p>
        </FeatureRow>
      </div>

      {/* One honest, page-wide disclosure for all the illustrative previews above. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-2 text-center sm:px-6">
        <p className="mx-auto max-w-2xl text-[12px] leading-6 text-[var(--vt-muted)]">
          The charts, conversations, records and journal entries shown on this page are illustrative examples, not live data, trading advice or a prediction of results.
        </p>
      </div>
    </div>
  );
}
