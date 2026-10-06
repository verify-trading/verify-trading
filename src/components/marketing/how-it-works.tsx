import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import type { ReactNode } from "react";

import { APP_ICONS, type AppIconKey } from "@/components/icons/app-icons";
import { CtaLink } from "@/components/marketing/cta-link";
import { Battery, BrandMark, SignalBars } from "@/components/landing/hero-ask-demo/shared";
import { SectionEyebrow, surface } from "@/components/landing/section-primitives";
import { cn } from "@/lib/utils";

/** Set to the hosted video file (mp4/webm URL or /public path) once the client delivers it. */
export const HOW_IT_WORKS_VIDEO_SRC: string | undefined = undefined;

/** Hero video slot. Renders the real player when `src` is set, otherwise a "coming soon" poster. */
export function HowItWorksVideo({ src = HOW_IT_WORKS_VIDEO_SRC }: { src?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {src ? (
        <video className="size-full object-cover" src={src} controls playsInline preload="metadata" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
            <Play className="size-6 translate-x-0.5 fill-white text-white" aria-hidden />
          </span>
          <p className="text-sm text-slate-400">Video coming soon</p>
        </div>
      )}
    </div>
  );
}

/* ─── Phone visuals ─── */
/* Display-only app screens: app styling (tokens, tabs, cards), illustrative sample data. */

const card = "rounded-lg border border-[rgba(76,110,245,0.18)] bg-[#0F1340]";
const label = "text-[7px] font-bold uppercase tracking-[0.12em]";
const UP = "text-[#22C55E]";
const DOWN = "text-[var(--vt-coral)]";

/** Top slice of a phone: the screen is cropped at the card's bottom edge. */
function Phone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[190px] w-[210px] shrink-0 overflow-hidden rounded-t-[2rem] border-[5px] border-b-0 border-[#262d63] bg-[var(--vt-navy)] shadow-[0_-10px_40px_rgba(76,110,245,0.35)] sm:mx-0 sm:h-[240px] sm:w-[190px] sm:self-end"
    >
      <div className="flex items-center justify-between px-4 pt-2 text-[8px] font-semibold text-white">
        <span>9:41</span>
        <span className="h-[13px] w-[48px] rounded-full bg-black" />
        <span className="flex items-center gap-1">
          <SignalBars />
          <Battery />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 px-3">
        <BrandMark size={16} />
        <span className="text-[12px] font-bold tracking-tight text-white">{title}</span>
      </div>
      <div className="mt-2 space-y-1.5 px-3">{children}</div>
    </div>
  );
}

const MARKET_TABS = ["Markets", "Intelligence", "Economic"];

function Tabs({ active }: { active: number }) {
  return (
    <div className="-mx-3 flex gap-3 border-b border-[rgba(76,110,245,0.18)] px-3">
      {MARKET_TABS.map((t, i) => (
        <span
          key={t}
          className={cn(
            "border-b-2 pb-1 text-[8px]",
            i === active ? "border-[var(--vt-coral)] font-semibold text-white" : "border-transparent text-[#8892B0]",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Spark({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 40 14" className="h-3.5 w-10 shrink-0" fill="none">
      <polyline
        points={up ? "0,11 6,9 11,10 17,6 23,7 29,4 34,5 40,2" : "0,3 6,5 11,4 17,8 23,7 29,10 34,9 40,12"}
        stroke={up ? "#22C55E" : "#F26D6D"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const QUOTES = [
  { sym: "XAU/USD", name: "Gold", px: "2,648.40", ch: "+0.91%", up: true },
  { sym: "BTC/USD", name: "Bitcoin", px: "64,210", ch: "+2.48%", up: true },
  { sym: "EUR/USD", name: "Euro / Dollar", px: "1.1042", ch: "−0.12%", up: false },
];

const askScreen = (
  <Phone title="Ask">
    <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-[var(--vt-blue)] px-2.5 py-1.5 text-[9px] text-white">Is this prop firm legit?</p>
    <div className={cn(card, "p-2")}>
      <p className={cn(label, "flex items-center gap-1", UP)}>
        <span className="size-1.5 rounded-full bg-[#22C55E]" />
        Verified record
      </p>
      <p className="mt-1 text-[10px] font-semibold text-white">Registered · no warnings</p>
      <p className="mt-0.5 text-[8px] leading-snug text-[#8892B0]">Checked against regulator registers and warning lists.</p>
      <div className="mt-1.5 flex gap-1">
        {["Register", "Sources"].map((c) => (
          <span key={c} className="rounded-full bg-[var(--vt-blue)]/15 px-1.5 py-0.5 text-[7px] font-semibold text-[#8fa5ff]">{c} ↗</span>
        ))}
      </div>
    </div>
    <p className="rounded-full border border-[rgba(76,110,245,0.18)] px-2.5 py-1.5 text-[8px] text-[#8892B0]">Ask anything…</p>
  </Phone>
);

const marketsScreen = (
  <Phone title="Markets">
    <Tabs active={0} />
    {QUOTES.map((q) => (
      <div key={q.sym} className={cn(card, "flex items-center gap-1.5 px-2 py-1.5")}>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold text-white">{q.sym}</p>
          <p className="truncate text-[7px] text-[#8892B0]">{q.name}</p>
        </div>
        <Spark up={q.up} />
        <div className="w-[42px] text-right">
          <p className="font-mono text-[8px] font-semibold text-white">{q.px}</p>
          <p className={cn("font-mono text-[7px] font-bold", q.up ? UP : DOWN)}>{q.ch}</p>
        </div>
      </div>
    ))}
  </Phone>
);

const intelligenceScreen = (
  <Phone title="Markets">
    <Tabs active={1} />
    <div className={cn(card, "p-2")}>
      <p className={cn(label, UP)}>Daily brief</p>
      <p className="mt-1 text-[8.5px] leading-snug text-[#C8D0E7]">Risk tone steady into London. Focus on US data and gold.</p>
    </div>
    {[
      { a: "Gold", b: "Bullish", t: UP },
      { a: "EUR/USD", b: "Neutral", t: "text-[#8892B0]" },
      { a: "GBP/USD", b: "Bearish", t: DOWN },
    ].map((r) => (
      <div key={r.a} className={cn(card, "flex items-center justify-between bg-[#0C1037] px-2 py-1.5")}>
        <span className="text-[9px] font-bold text-white">{r.a}</span>
        <span className={cn(label, r.t)}>{r.b}</span>
      </div>
    ))}
  </Phone>
);

const calendarScreen = (
  <Phone title="Markets">
    <Tabs active={2} />
    <div className="flex items-center gap-2 rounded-lg border border-[var(--vt-coral)]/25 bg-[var(--vt-coral)]/[0.06] px-2 py-1.5">
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--vt-coral)]" />
      <div className="min-w-0 flex-1">
        <p className={cn(label, DOWN)}>Up next</p>
        <p className="truncate text-[9px] font-semibold text-white">US Payrolls</p>
      </div>
      <span className="rounded-md bg-[var(--vt-coral)]/20 px-1.5 py-1 text-[8px] font-bold tabular-nums text-[var(--vt-coral)]">2h 14m</span>
    </div>
    <div className={cn(card, "divide-y divide-[rgba(76,110,245,0.18)]")}>
      {[
        { time: "07:00", ccy: "GBP", ev: "CPI y/y", imp: "High", dot: "bg-[var(--vt-coral)]" },
        { time: "13:30", ccy: "USD", ev: "Payrolls", imp: "High", dot: "bg-[var(--vt-coral)]" },
        { time: "15:00", ccy: "USD", ev: "ISM Services", imp: "Med", dot: "bg-[#F59E0B]" },
      ].map((e) => (
        <div key={e.ev} className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-7 shrink-0">
            <p className="text-[8px] font-bold tabular-nums text-white">{e.time}</p>
            <p className="text-[7px] font-semibold text-[#8892B0]">{e.ccy}</p>
          </div>
          <p className="min-w-0 flex-1 truncate text-[8.5px] font-semibold text-white">{e.ev}</p>
          <span className="flex items-center gap-1 text-[7px] font-bold uppercase text-[#8892B0]">
            <span className={cn("size-1.5 rounded-full", e.dot)} />
            {e.imp}
          </span>
        </div>
      ))}
    </div>
  </Phone>
);

// 0 = no trade, 1 = green day, 2 = red day
const JOURNAL_DAYS = [0, 1, 1, 2, 1, 0, 0, 1, 2, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 0, 0];

const journalScreen = (
  <Phone title="Journal">
    <div className="grid grid-cols-3 gap-1">
      {[
        { k: "Win rate", v: "62%", t: "text-white" },
        { k: "Net P&L", v: "+£1.2k", t: UP },
        { k: "Streak", v: "4 wins", t: "text-white" },
      ].map((s) => (
        <div key={s.k} className={cn(card, "px-1.5 py-1")}>
          <p className="text-[6.5px] text-[#8892B0]">{s.k}</p>
          <p className={cn("text-[9px] font-bold", s.t)}>{s.v}</p>
        </div>
      ))}
    </div>
    <div className={cn(card, "p-2")}>
      <p className="text-[9px] font-semibold text-white">October</p>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
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
    </div>
  </Phone>
);

const mindScreen = (
  <Phone title="Mind">
    <div className={cn(card, "flex items-center gap-2.5 p-2")}>
      <svg viewBox="0 0 36 36" className="size-11 shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="#F26D6D" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="68 94.2" />
      </svg>
      <div>
        <p className="text-[14px] font-bold leading-none text-white">72</p>
        <p className="mt-1 text-[7.5px] text-[#8892B0]">Discipline score</p>
      </div>
    </div>
    {[
      { k: "Discipline", v: 78, c: "bg-[var(--vt-blue)]" },
      { k: "Emotions", v: 64, c: "bg-[#8b5cf6]" },
      { k: "Focus", v: 71, c: "bg-[var(--vt-coral)]" },
    ].map((r) => (
      <div key={r.k} className={cn(card, "px-2 py-1.5")}>
        <div className="flex justify-between text-[8px]">
          <span className="font-semibold text-white">{r.k}</span>
          <span className="tabular-nums text-[#8892B0]">{r.v}%</span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-white/[0.08]">
          <div className={cn("h-full rounded-full", r.c)} style={{ width: `${r.v}%` }} />
        </div>
      </div>
    ))}
  </Phone>
);

/* ─── Step cards ─── */

type Step = {
  n: string;
  icon: AppIconKey;
  title: string;
  body: string;
  href: string;
  cta: string;
  tier: "Free" | "Pro";
  visual: ReactNode;
};

const STEPS: Step[] = [
  { n: "01", icon: "ask", title: "Ask", body: "Ask about any broker, prop firm, setup or market and get a sourced answer in seconds.", href: "/ask", cta: "Go to Ask", tier: "Free", visual: askScreen },
  { n: "02", icon: "markets", title: "Markets", body: "Live prices across gold, forex, indices and crypto, with the context behind each move.", href: "/markets", cta: "Go to Markets", tier: "Free", visual: marketsScreen },
  { n: "03", icon: "intelligence", title: "Intelligence", body: "A daily pre-session brief: the bias, the key level and what to watch for each major asset.", href: "/intelligence", cta: "Go to Intelligence", tier: "Pro", visual: intelligenceScreen },
  { n: "04", icon: "calendar", title: "Economic Calendar", body: "See CPI, NFP and FOMC coming, with impact levels and a heads-up before high-impact releases.", href: "/economic-calendar", cta: "Go to Economic Calendar", tier: "Pro", visual: calendarScreen },
  { n: "05", icon: "journal", title: "Journal", body: "Log every trade, spot the patterns that cost you, and run Challenge Mode for prop firm evaluations.", href: "/journal", cta: "Go to Journal", tier: "Pro", visual: journalScreen },
  { n: "06", icon: "mind", title: "Mind", body: "Build discipline, catch tilt early and trade with a clear head.", href: "/mind", cta: "Go to Mind", tier: "Pro", visual: mindScreen },
];

export function HowItWorksSteps() {
  return (
    <ol className="grid gap-4 lg:grid-cols-2">
      {STEPS.map((s) => {
        const Icon = APP_ICONS[s.icon];
        return (
          <li key={s.n} className={cn(surface, "flex flex-col gap-5 overflow-hidden bg-[linear-gradient(160deg,rgba(76,110,245,0.08),transparent_60%)] px-5 pt-5 transition hover:border-[var(--vt-blue)]/40 sm:min-h-[260px] sm:flex-row sm:gap-4 sm:pr-0 sm:pl-6 sm:pt-6")}>
            <div className="flex min-w-0 flex-1 flex-col sm:pb-6">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl font-bold tabular-nums text-[var(--vt-coral)]">{s.n}</span>
                <Icon className="size-6 text-[var(--vt-coral)]" />
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    s.tier === "Free" ? "bg-emerald-500/15 text-emerald-300" : "bg-violet-500/20 text-violet-300",
                  )}
                >
                  {s.tier}
                </span>
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{s.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{s.body}</p>
              <span aria-hidden className="hidden flex-1 sm:block" />
              <Link
                href={s.href}
                prefetch={false}
                className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--vt-blue)]/70 px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--vt-blue)]/15"
              >
                {s.cta}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {s.visual}
          </li>
        );
      })}
    </ol>
  );
}

/* ─── CTA banner ─── */

export function HowItWorksCtaBanner() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col items-start gap-6 rounded-2xl border border-white/15 bg-[linear-gradient(110deg,rgba(76,110,245,0.18),rgba(139,92,246,0.14)_55%,rgba(242,109,109,0.22))] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <SectionEyebrow>Ready to trade smarter?</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Join the traders already using verify.trading.
          </h2>
          <p className="mt-2 text-sm text-slate-300">Start free and check your first broker in seconds.</p>
        </div>
        <CtaLink href="/signup" event="signup" location="how_it_works_banner">
          Get Started
          <ArrowRight aria-hidden />
        </CtaLink>
      </div>
    </section>
  );
}
