"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Earth,
  Ellipsis,
  FileUp,
  FingerprintPattern,
  ImagePlus,
  Link2,
  MessagesSquare,
  Phone,
  Pin,
  Plus,
  Shield,
  Star,
  Users,
  X,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AskNavIcon, MarketsNavIcon } from "@/components/site/site-nav";
import { cn } from "@/lib/utils";

import { addDays, monthDay, monthYear, pnlLabel, samplePnl, useDemoToday, weekdayShort, weekRange } from "./demo-dates";
import { BrandMark } from "./shared";
import type { DemoScreen } from "./types";

/**
 * Static, sample-data mocks of the Pro app screens (Markets, Economic calendar,
 * Journal, Mind), copied from the mobile app (verify-trading-mobile/src):
 * MarketsScreen + MarketsPanels + CalendarEventList, JournalHeader/JournalTabs/
 * WeekStrip/CalendarGrid/JournalPanels, PsychologyScreen + SessionsList + MindHero/
 * MindStats/MindRadar, and navigation/GlassTabBar. Sizes are the app's values
 * scaled ~0.94 to the 368px demo screen. Nothing here is live.
 */

const LINE = "border-[var(--vt-border)]";
const PANEL = "bg-[#0C1037]";
/** The app's Surface: one elevation for every content card. */
const surface = cn("rounded-2xl border bg-[var(--vt-card)] shadow-[0_6px_12px_rgba(0,0,0,0.22)]", LINE);
const sectionLabel = "text-[8.5px] font-bold uppercase tracking-[1px] text-[var(--vt-muted)]";
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/* ─── Header + tab bar ─── */

type ProScreen = Exclude<DemoScreen, "ask">;

const HEADERS: Record<ProScreen, { title: string; subtitle: string }> = {
  markets: { title: "Markets", subtitle: "Updated 3m ago" },
  calendar: { title: "Markets", subtitle: "Updated 3m ago" },
  journal: { title: "Journal", subtitle: "Only you see what you log here" },
  mind: { title: "MIND", subtitle: "Neuro Discipline" },
  chat: { title: "Members chat", subtitle: "14 online · Pro community" },
};

export function HeaderButton({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-[38px] cursor-pointer items-center justify-center rounded-xl border bg-[var(--vt-card)] text-[#C8D0E7] transition hover:bg-white/10 hover:text-white",
        LINE,
      )}
    >
      {children}
    </span>
  );
}

/** The app's large tab-root header: logo, title, subtitle, optional action buttons. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="relative z-20 flex items-center justify-between gap-3 px-[15px] pb-2.5 pt-1.5 text-left">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <BrandMark size={28} />
        <div className="min-w-0">
          <p className="truncate text-[22.4px] font-bold leading-tight tracking-[-0.5px] text-white">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-[10px] text-[var(--vt-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Header for a Pro screen; the Ask header lives in variant-device. */
export function ProHeader({ screen }: { screen: ProScreen }) {
  const { title, subtitle } = HEADERS[screen];
  return (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      right={
        screen === "journal" ? (
          <>
            <HeaderButton>
              <FileUp className="size-[17px]" strokeWidth={2} aria-hidden />
            </HeaderButton>
            <HeaderButton>
              <Plus className="size-[17px]" strokeWidth={2} aria-hidden />
            </HeaderButton>
          </>
        ) : screen === "chat" ? (
          <>
            <HeaderButton>
              <Users className="size-[17px]" strokeWidth={2} aria-hidden />
            </HeaderButton>
            <HeaderButton>
              <Shield className="size-[17px]" strokeWidth={2} aria-hidden />
            </HeaderButton>
          </>
        ) : null
      }
    />
  );
}

function JournalNavIcon({ size = 24, strokeWidth = 1.6 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 2.5H8a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2V7.5z" />
      <path d="M14.5 2.5v3a2 2 0 0 0 2 2h3" />
      <path d="M3.5 6.5H7M3.5 10.2H7M3.5 13.9H7M3.5 17.6H7" />
      <path d="m10 14 2.4 2.4 4.6-5" />
    </svg>
  );
}

type TabDef = {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** The demo screen a tap jumps to. Chat and More are shown but not part of the demo. */
  screen?: DemoScreen;
};

const TABS: TabDef[] = [
  { label: "Ask", icon: AskNavIcon, screen: "ask" },
  { label: "Markets", icon: MarketsNavIcon, screen: "markets" },
  { label: "Journal", icon: JournalNavIcon, screen: "journal" },
  { label: "Mind", icon: FingerprintPattern, screen: "mind" },
  { label: "Chat", icon: MessagesSquare, screen: "chat" },
  { label: "More", icon: Ellipsis },
];

/** Which tab lights up for each demo screen (the calendar lives inside Markets). */
const ACTIVE_TAB: Record<DemoScreen, string> = {
  ask: "Ask",
  markets: "Markets",
  calendar: "Markets",
  journal: "Journal",
  mind: "Mind",
  chat: "Chat",
};

/** GlassTabBar: translucent navy, hairline top border, coral active tab that lifts and glows. */
export function DemoTabBar({
  screen,
  onSelect,
}: {
  screen: DemoScreen;
  onSelect: (screen: DemoScreen) => void;
}) {
  return (
    <div className="relative z-20 flex border-t border-white/10 bg-[rgba(10,13,46,0.85)] px-1 pb-1 pt-[9px] backdrop-blur-xl">
      {TABS.map((tab) => {
        const active = ACTIVE_TAB[screen] === tab.label;
        const Icon = tab.icon;
        const inner = (
          <>
            <span
              className={cn(
                "transition-[transform,filter] duration-200",
                active
                  ? "-translate-y-0.5 scale-[1.08] text-[var(--vt-coral)] [filter:drop-shadow(0_0_5px_rgba(242,109,109,0.85))]"
                  : "text-[#C8D0E7]",
              )}
            >
              <Icon size={23} strokeWidth={active ? 1.9 : 1.6} />
            </span>
            <span
              className={cn(
                "truncate max-w-full text-[9px] tracking-[0.1px]",
                active ? "font-semibold text-[var(--vt-coral)]" : "font-medium text-[var(--vt-muted)]",
              )}
            >
              {tab.label}
            </span>
          </>
        );
        const cls = "flex min-w-0 flex-1 flex-col items-center gap-1.5 py-1.5 cursor-pointer";
        return tab.screen ? (
          <button
            key={tab.label}
            type="button"
            onClick={() => onSelect(tab.screen!)}
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            className={cls}
          >
            {inner}
          </button>
        ) : (
          <span key={tab.label} className={cls} aria-hidden>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Markets: sub-tab strip, Intelligence, Economic calendar ─── */

const MARKET_TABS = ["Markets", "Intelligence", "Economic"] as const;
type MarketTab = (typeof MARKET_TABS)[number];

/** TabStrip; the coral underline slides between tabs like a real sub-tab switch. */
function MarketsTabs({
  active,
  onSelectTab,
}: {
  active: MarketTab;
  onSelectTab?: (tab: MarketTab) => void;
}) {
  return (
    <div className={cn("relative z-30 flex gap-6 border-b px-[15px] pt-2", LINE)}>
      {MARKET_TABS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectTab?.(t);
          }}
          className={cn(
            "relative cursor-pointer pb-[11px] text-[13px] transition-colors hover:text-white",
            t === active ? "font-semibold text-white" : "font-medium text-[var(--vt-muted)]",
          )}
        >
          {t}
          {t === active ? (
            <motion.span
              layoutId="demo-markets-underline"
              className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[var(--vt-coral)]"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function BriefAsset({
  name,
  level,
  bias,
  tone,
  verdict,
}: {
  name: string;
  level: string;
  bias: string;
  tone: string;
  verdict: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-[13px]", PANEL, LINE)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.6px] font-bold text-white">{name}</span>
        <span className="font-mono text-[9.6px] text-[var(--vt-muted)]">{level}</span>
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        <span className={cn("mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.75px]", tone)}>{bias}</span>
        <span className="flex-1 text-[10.3px] leading-[15.2px] text-[#C8D0E7]">{verdict}</span>
      </div>
    </div>
  );
}

const RADAR = [
  {
    tag: "Macro",
    title: "Dollar softens as traders price a December cut",
    summary: "Futures now lean toward easing, keeping majors bid into the US open.",
  },
  {
    tag: "Metals",
    title: "Gold holds above $4,090 support",
    summary: "Safe-haven demand steady; watch CPI for a break of the range.",
  },
];

function MarketsIntelligence() {
  return (
    <div className="space-y-3 px-[15px] pt-3">
      <div className={cn(surface, "p-[15px]")}>
        <p className="text-[8.8px] font-bold uppercase tracking-[1.3px] text-[var(--vt-green)]">Daily brief</p>
        <p className="mt-3 text-[12.4px] leading-[18.4px] text-[#C8D0E7]">
          Gold is quoted near $4,118 and the dollar is softer into the London open, keeping bullion bid ahead
          of US CPI at 13:30.
        </p>
        <div className={cn("mt-4 rounded-xl border p-[13px]", PANEL, LINE)}>
          <p className="text-[8.5px] font-bold uppercase tracking-[1.1px] text-[var(--vt-muted)]">Session tone</p>
          <p className="mt-2 text-[11.2px] leading-[16.7px] text-[#C8D0E7]">
            Cautious into the open, event-driven after 13:30.
          </p>
        </div>
        <div className="mt-3 space-y-2">
          <BriefAsset
            name="Gold"
            level="$4,118"
            bias="Bullish"
            tone="text-[var(--vt-green)]"
            verdict="Above $4,098 keeps buyers in control."
          />
          <BriefAsset
            name="EUR/USD"
            level="1.0842"
            bias="Neutral"
            tone="text-[var(--vt-blue)]"
            verdict="Range-bound until the CPI print."
          />
        </div>
      </div>
      <div className={cn(surface, "p-[15px]")}>
        <div className="mb-1 flex items-baseline justify-between">
          <p className="text-[13.6px] font-bold tracking-[-0.2px] text-white">Market radar</p>
          <p className="text-[8.8px] text-[var(--vt-muted)]">Updated 3m ago</p>
        </div>
        {RADAR.map((r, i) => (
          <div key={r.title} className={cn("py-[13px]", i < RADAR.length - 1 && cn("border-b", LINE))}>
            <p className={sectionLabel}>{r.tag}</p>
            <p className="mt-2 text-[12px] font-semibold leading-[16.7px] text-white">{r.title}</p>
            <p className="mt-1 text-[10.8px] leading-4 text-[#C8D0E7]">{r.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type CalEvent = {
  time: string;
  flag: string;
  cur: string;
  title: string;
  impact: "HIGH" | "MED";
  act?: string;
  fcst?: string;
  prev?: string;
  /** Actual against consensus: drives the green/red arrow. */
  trend?: "above" | "below";
};

const CAL_TODAY: CalEvent[] = [
  { time: "07:00", flag: "🇬🇧", cur: "GBP", title: "Nationwide HPI (MoM)", impact: "MED", act: "0.5", fcst: "0.2", prev: "0.3", trend: "above" },
  { time: "08:55", flag: "🇩🇪", cur: "EUR", title: "Unemployment Change", impact: "MED", act: "8K", fcst: "12K", prev: "11K", trend: "below" },
  { time: "13:30", flag: "🇺🇸", cur: "USD", title: "Core PCE Price Index (MoM)", impact: "HIGH", fcst: "0.2%", prev: "0.2%" },
  { time: "13:30", flag: "🇨🇦", cur: "CAD", title: "GDP (MoM)", impact: "HIGH", fcst: "0.1%", prev: "-0.1%" },
  { time: "15:00", flag: "🇺🇸", cur: "USD", title: "CB Consumer Confidence", impact: "MED", fcst: "94.0", prev: "97.4" },
];

const CAL_TOMORROW: CalEvent[] = [
  { time: "09:30", flag: "🇬🇧", cur: "GBP", title: "GDP (QoQ)", impact: "HIGH", fcst: "0.3%", prev: "0.3%" },
  { time: "13:15", flag: "🇺🇸", cur: "USD", title: "ADP Employment Change", impact: "MED", fcst: "125K", prev: "99K" },
];

function Figure({ name, value, trend, strong }: { name: string; value?: string; trend?: "above" | "below"; strong?: boolean }) {
  const Arrow = trend === "above" ? ArrowUp : ArrowDown;
  return (
    <span className="flex items-center gap-1">
      <span className="text-[8.5px] font-bold uppercase tracking-[0.5px] text-[var(--vt-muted)]">{name}</span>
      <span
        style={tabular}
        className={cn(
          "text-[10px]",
          strong ? "font-bold" : "font-semibold",
          trend === "above" && "text-[var(--vt-green)]",
          trend === "below" && "text-[var(--vt-coral)]",
          !trend && (value ? (strong ? "text-white" : "text-[#C8D0E7]") : "text-[var(--vt-muted)]"),
        )}
      >
        {value || "—"}
      </span>
      {trend ? (
        <Arrow
          className={cn("size-[10px]", trend === "above" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]")}
          strokeWidth={2.75}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

function EventRow({ e, last }: { e: CalEvent; last: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 px-[13px] py-3", !last && cn("border-b", LINE))}>
      <div className="w-[58px] shrink-0">
        <p style={tabular} className="text-[10.3px] font-bold text-white">
          {e.time}
        </p>
        <p className="mt-0.5 whitespace-nowrap text-[9.4px] font-semibold tracking-[0.4px] text-[var(--vt-muted)]">
          {e.flag} {e.cur}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[11.2px] font-semibold leading-[15px] text-white">{e.title}</p>
          <span className="mt-[3px] flex shrink-0 items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.7px] text-[var(--vt-muted)]">
            <span className={cn("size-1.5 rounded-full", e.impact === "HIGH" ? "bg-[var(--vt-coral)]" : "bg-[var(--vt-amber)]")} />
            {e.impact}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Figure name="Act" value={e.act} trend={e.trend} strong />
          <Figure name="Fcst" value={e.fcst} />
          <Figure name="Prev" value={e.prev} />
        </div>
      </div>
    </div>
  );
}

function DayGroup({ title, detail, events, count }: { title: string; detail: string; events: CalEvent[]; count: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
        <p className="text-[12px] font-bold tracking-[-0.2px] text-white">
          {title} <span className="font-semibold text-[var(--vt-muted)]">{detail}</span>
        </p>
        <p className={sectionLabel}>{count} events</p>
      </div>
      <div className={cn("overflow-hidden rounded-2xl border bg-[var(--vt-card)]", LINE)}>
        {events.map((e, i) => (
          <EventRow key={e.time + e.title} e={e} last={i === events.length - 1} />
        ))}
      </div>
    </div>
  );
}

function ImpactChip({ dot, label }: { dot: string; label: string }) {
  // Both impact levels are on by default in the app, so both read as selected.
  return (
    <span className="flex h-[38px] items-center gap-1 rounded-xl border border-[var(--vt-blue)] bg-[var(--vt-blue)]/15 px-2 text-[10px] font-semibold text-white sm:px-3 sm:text-[10.8px]">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

/** Density dots by weekday, like the week rail: busy weekdays carry High + Med, weekends stay quiet. */
function dotsFor(date: Date, index: number) {
  if (date.getDay() === 0 || date.getDay() === 6) return "none" as const;
  return (["both", "both", "high", "both", "med"] as const)[index % 5];
}

function EconomicCalendar() {
  const today = useDemoToday();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const tomorrow = days[1];
  return (
    <div className="space-y-[15px] px-[15px] pt-3">
      <div className="flex gap-2">
        <span className={cn("flex h-[38px] min-w-0 flex-1 items-center gap-1.5 rounded-xl border bg-[var(--vt-card)] px-2.5 sm:gap-2 sm:px-[13px]", LINE)}>
          <Earth className="size-[14px] shrink-0 text-[var(--vt-muted)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#C8D0E7] sm:text-[10.8px]">All countries</span>
          <ChevronDown className="size-3 shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </span>
        <ImpactChip dot="bg-[var(--vt-coral)]" label="High" />
        <ImpactChip dot="bg-[var(--vt-amber)]" label="Med" />
      </div>

      <div className={cn(surface, "p-[15px]")}>
        <div className="flex">
          {days.map((d, i) => {
            const dots = dotsFor(d, i);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={cn("text-[8.5px] font-semibold uppercase", i === 0 ? "text-[var(--vt-coral)]" : "text-[var(--vt-muted)]")}>
                  {weekdayShort(d)}
                </span>
                <span
                  style={tabular}
                  className={cn(
                    "flex size-[26px] items-center justify-center rounded-full text-[11px] font-bold sm:size-[30px] sm:text-[12px]",
                    i === 0 ? "border border-[var(--vt-coral)]/40 text-[var(--vt-coral)]" : "text-white/90",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-[3px]">
                  {dots === "both" || dots === "high" ? <span className="size-1.5 rounded-full bg-[var(--vt-coral)]" /> : null}
                  {dots === "both" || dots === "med" ? <span className="size-1.5 rounded-full bg-[var(--vt-amber)]" /> : null}
                  {dots === "none" ? <span className="size-1 rounded-full bg-[var(--vt-muted)]/30" /> : null}
                </span>
              </div>
            );
          })}
        </div>
        <p className={cn("mt-3 border-t pt-2.5 text-[9.2px] font-medium text-[var(--vt-muted)]", LINE)}>
          {weekRange(today, days[6])} · 19 events
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--vt-coral)]/25 bg-[var(--vt-coral)]/[0.06] px-[13px] py-3">
        <span className="size-2 rounded-full bg-[var(--vt-coral)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[8.5px] font-bold uppercase tracking-[1.1px] text-[var(--vt-coral)]">Next high impact</p>
          <p className="mt-1 truncate text-[11.2px] font-semibold text-white">Core PCE Price Index (MoM)</p>
          <p className="mt-0.5 truncate text-[9.2px] text-[var(--vt-muted)]">🇺🇸 USD · 13:30 today</p>
        </div>
        <span style={tabular} className="rounded-lg bg-[var(--vt-coral)]/20 px-2.5 py-1.5 text-[10px] font-bold text-[var(--vt-coral)]">
          3h 11m
        </span>
      </div>

      <div className="space-y-5">
        <DayGroup title="Today" detail={monthDay(today)} events={CAL_TODAY} count={5} />
        <DayGroup title="Tomorrow" detail={monthDay(tomorrow)} events={CAL_TOMORROW} count={6} />
      </div>
    </div>
  );
}

/** Markets screen: the sub-tab strip stays put while Intelligence and Economic swap under it. */
function MarketsBody({
  tab,
  onSelectScreen,
}: {
  tab: "Intelligence" | "Economic";
  onSelectScreen?: (screen: DemoScreen) => void;
}) {
  const reduced = useReducedMotion();
  const handleSelectTab = (t: MarketTab) => {
    if (t === "Economic") {
      onSelectScreen?.("calendar");
    } else {
      onSelectScreen?.("markets");
    }
  };

  return (
    <>
      <MarketsTabs active={tab} onSelectTab={handleSelectTab} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduced ? false : { opacity: 0, x: tab === "Economic" ? 14 : -14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: "easeOut" }}
        >
          {tab === "Economic" ? <EconomicCalendar /> : <MarketsIntelligence />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/* ─── Journal ─── */

/** 30-day mood trend: good/okay/tough bars, newest on the left, some days empty. */
const MOOD = "GGOGTGNNOGGGONGTGGNNOGGTGONGGO";
const MOOD_BAR: Record<string, string> = {
  G: "h-8 bg-[var(--vt-green)]",
  O: "h-5 bg-[var(--vt-amber)]",
  T: "h-3 bg-[var(--vt-coral)]",
  N: "h-1.5 bg-[var(--vt-border)]",
};

function MoodTrend() {
  const logged = [...MOOD].filter((c) => c !== "N").length;
  return (
    <div className={cn(surface, "p-[15px]")}>
      <p className={cn(sectionLabel, "mb-2.5")}>30-day mood trend</p>
      <div className="flex h-[34px] items-end gap-1">
        {[...MOOD].map((c, i) => (
          <span key={i} className={cn("flex-1 rounded-full", MOOD_BAR[c])} />
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-[14px] text-[var(--vt-muted)]">
        {logged} sessions in the last 30 days · newest on the left
      </p>
    </div>
  );
}

function ConnectBrokerPill() {
  return (
    <div className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--vt-green)]/40 bg-[var(--vt-green)]/10 py-3 pl-3 pr-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--vt-green)]/40 bg-[var(--vt-green)]/10">
        <Link2 className="size-4 text-[var(--vt-green)]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.4px] font-semibold text-white">Connect your broker</p>
        <p className="mt-0.5 text-[10px] leading-[13.6px] text-[#C8D0E7]">Your closed trades fill the journal on their own</p>
      </div>
      <ChevronRight className="size-[15px] text-[var(--vt-green)]" aria-hidden />
      <span className="flex size-7 items-center justify-center">
        <X className="size-3.5 text-[var(--vt-muted)]" aria-hidden />
      </span>
    </div>
  );
}

const CHIP = {
  win: "border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.2)] text-[var(--vt-green)]",
  loss: "border-[rgba(242,109,109,0.45)] bg-[rgba(242,109,109,0.2)] text-[var(--vt-coral)]",
  none: "border-transparent bg-[var(--vt-card-alt)] text-[var(--vt-muted)]",
} as const;

function WeekStrip({ today }: { today: Date }) {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  return (
    <div className={cn(surface, "p-[15px]")}>
      <p className={cn(sectionLabel, "mb-2.5")}>This week</p>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => {
          const d = addDays(monday, i);
          const pnl = samplePnl(d, today);
          const tone = pnl == null ? "none" : pnl > 0 ? "win" : "loss";
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.5px] text-[var(--vt-muted)]">
                {weekdayShort(d)}
              </span>
              <span
                style={tabular}
                className={cn("flex h-[24px] w-full items-center justify-center rounded-full border text-[8.5px] font-bold", CHIP[tone])}
              >
                {pnl == null ? "—" : pnlLabel(pnl)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** heatColor from the app: green/coral fill that deepens with the size of the day. */
function heat(pnl: number | null) {
  if (!pnl) return undefined;
  const a = Math.min(0.45, Math.abs(pnl) / 700) + 0.06;
  return pnl > 0 ? `rgba(34,197,94,${a})` : `rgba(242,109,109,${a})`;
}

function JournalCalendar({ today }: { today: Date }) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const length = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: (first.getDay() + 6) % 7 }, () => null),
    ...Array.from({ length }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  let best: Date | null = null;
  for (const d of cells) {
    if (d && (samplePnl(d, today) ?? 0) > (best ? (samplePnl(best, today) ?? 0) : 0)) best = d;
  }
  return (
    <div className={cn(surface, "p-[15px]")}>
      <div className="mb-4 flex items-center justify-between">
        <span className={cn("flex size-[34px] cursor-pointer items-center justify-center rounded-xl border bg-[var(--vt-card)] text-[#C8D0E7] transition hover:bg-white/10 hover:text-white", LINE)}>
          <ChevronLeft className="size-[17px]" aria-hidden />
        </span>
        <p className="text-[14.4px] font-bold tracking-[-0.3px] text-white">{monthYear(today)}</p>
        <span className="flex size-[34px] cursor-pointer items-center justify-center rounded-xl border border-transparent text-[#C8D0E7] opacity-25">
          <ChevronRight className="size-[17px]" aria-hidden />
        </span>
      </div>
      <div className="mb-2.5 grid grid-cols-7 gap-1 sm:gap-[7px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center text-[9px] font-bold uppercase tracking-[0.5px] text-[var(--vt-muted)] sm:text-[9.6px]">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-[7px]">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const pnl = samplePnl(d, today);
          const isToday = d.getTime() === today.getTime();
          return (
            <span
              key={i}
              style={{ backgroundColor: heat(pnl) ?? (pnl === null ? "#0C1037" : "var(--vt-card)") }}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[10px] border sm:rounded-[15px]",
                isToday
                  ? "border-2 border-[var(--vt-coral)] shadow-[0_0_8px_rgba(242,109,109,0.5)]"
                  : pnl !== null
                    ? "border-[var(--vt-border)]"
                    : "border-transparent",
              )}
            >
              {best && d.getTime() === best.getTime() ? (
                <Star className="absolute right-1 top-1 size-[9px] fill-[#EAB308] text-[#EAB308]" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "text-[11px] leading-none sm:text-[12.8px]",
                  pnl !== null || isToday ? "font-bold text-white" : "font-medium text-[var(--vt-muted)]",
                )}
              >
                {d.getDate()}
              </span>
              {pnl !== null ? (
                <span
                  style={tabular}
                  className={cn("mt-0.5 text-[7.5px] font-bold sm:text-[8.5px]", pnl >= 0 ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]")}
                >
                  {pnlLabel(pnl)}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function JournalMock() {
  const today = useDemoToday();
  return (
    <div className="space-y-3 px-[15px]">
      <MoodTrend />
      <ConnectBrokerPill />
      <WeekStrip today={today} />
      <JournalCalendar today={today} />
    </div>
  );
}

/* ─── Mind ─── */

const SIDES = [
  ["Being wrong", 7],
  ["Fear", 11],
  ["Chasing", 6],
  ["Self awareness", 9],
  ["Discipline", 8],
] as const;
const FOCUS = "Fear";

function Radar() {
  const W = 280;
  const CX = 140;
  const CY = 98;
  const R = 60;
  const pt = (i: number, r: number) => {
    const a = ((-90 + (i * 360) / SIDES.length) * Math.PI) / 180;
    return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, cos: Math.cos(a) };
  };
  const poly = (r: (i: number) => number) =>
    SIDES.map((_, i) => `${pt(i, r(i)).x.toFixed(1)},${pt(i, r(i)).y.toFixed(1)}`).join(" ");
  return (
    <div className={cn(surface, "overflow-hidden p-[15px]")}>
      <p className="text-[12px] font-semibold text-white">The five sides</p>
      <p className="mt-0.5 text-[9.6px] leading-[13.6px] text-[var(--vt-muted)]">
        The further from the centre, the more it is costing you.
      </p>
      <svg viewBox={`0 0 ${W} 216`} className="mt-1 w-full" role="img" aria-label="Your five dimensions">
        <defs>
          <linearGradient id="demoRadarFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4C6EF5" stopOpacity="0.5" />
            <stop offset="1" stopColor="#F26D6D" stopOpacity="0.42" />
          </linearGradient>
        </defs>
        {[0.34, 0.67, 1].map((ring) => (
          <polygon
            key={ring}
            points={poly(() => R * ring)}
            fill="none"
            stroke={ring === 1 ? "rgba(76,110,245,0.4)" : "rgba(76,110,245,0.18)"}
          />
        ))}
        {SIDES.map((_, i) => (
          <line key={i} x1={CX} y1={CY} x2={pt(i, R).x} y2={pt(i, R).y} stroke="rgba(76,110,245,0.18)" />
        ))}
        <polygon
          points={poly((i) => R * (SIDES[i][1] / 15))}
          fill="url(#demoRadarFill)"
          stroke="#F26D6D"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {SIDES.map(([name, v], i) => {
          const focus = name === FOCUS;
          const vertex = pt(i, R * (v / 15));
          const label = pt(i, 80);
          const anchor = label.cos > 0.2 ? "start" : label.cos < -0.2 ? "end" : "middle";
          return (
            <g key={name}>
              <circle cx={vertex.x} cy={vertex.y} r={focus ? 4 : 2.5} fill={focus ? "#F26D6D" : "#4C6EF5"} />
              <text x={label.x} y={label.y} fontSize="9.5" fontWeight={focus ? 700 : 500} fill={focus ? "#F26D6D" : "#8892B0"} textAnchor={anchor}>
                {name}
              </text>
              <text x={label.x} y={label.y + 12} fontSize="10" fontWeight="700" fill={focus ? "#F26D6D" : "#fff"} textAnchor={anchor}>
                {v}/15
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MindMock() {
  const r = 44;
  const c = 2 * Math.PI * r;
  const score = 43;
  const total = 75;
  return (
    <div className="space-y-3 px-[15px] pt-2">
      {/* MindHero */}
      <div className={cn(surface, "relative overflow-hidden p-[15px]")}>
        <div
          className="pointer-events-none absolute -left-16 -top-28 size-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(76,110,245,0.34), rgba(110,52,196,0.15) 55%, transparent 100%)" }}
          aria-hidden
        />
        <div className="relative flex items-center gap-4">
          <div className="relative size-[98px] shrink-0">
            <svg viewBox="0 0 104 104" className="size-full" aria-hidden>
              <defs>
                <linearGradient id="demoMindRing" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#4C6EF5" />
                  <stop offset="0.5" stopColor="#8A5CF6" />
                  <stop offset="1" stopColor="#F26D6D" />
                </linearGradient>
              </defs>
              <circle cx="52" cy="52" r={r} fill="none" stroke="#0C1037" strokeWidth="8" />
              <circle
                cx="52"
                cy="52"
                r={r}
                fill="none"
                stroke="url(#demoMindRing)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(c * score) / total} ${c}`}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[25.6px] font-bold leading-[28px] tracking-[-1px] text-white">{score}</span>
              <span className="text-[8.5px] text-[var(--vt-muted)]">of {total}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={sectionLabel}>Where you are now</p>
            <p className="mt-1 text-[16px] font-bold leading-5 text-white">Reactive Trader</p>
            <p className="mt-1.5 text-[10.3px] leading-[14.6px] text-[#C8D0E7]">Fear is the strongest pattern right now.</p>
            <p className="mt-2 text-[9px] text-[var(--vt-muted)]">Assessed Yesterday</p>
          </div>
          <ChevronRight className="size-[17px] shrink-0 text-[var(--vt-muted)]" aria-hidden />
        </div>
      </div>

      {/* StartCard */}
      <div
        className="overflow-hidden rounded-3xl p-[19px] shadow-[0_12px_22px_rgba(242,109,109,0.3)]"
        style={{ backgroundImage: "linear-gradient(135deg, #4C6EF5, #6B21A8, #BE185D)" }}
      >
        <div className="flex items-center gap-4">
          <span className="flex size-[45px] shrink-0 items-center justify-center rounded-full bg-white/15">
            <Phone className="size-[21px] text-white" strokeWidth={2} aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-[13.6px] font-bold text-white">Start a new call</p>
            <p className="mt-0.5 text-[10.3px] leading-[14.4px] text-white/80">A live call with your Companion</p>
          </div>
          <ChevronRight className="size-5 text-white/85" aria-hidden />
        </div>
      </div>

      {/* MindStatsCard */}
      <div className={cn("overflow-hidden rounded-2xl border bg-[var(--vt-card)] px-[13px] pb-[13px] pt-4 shadow-[0_6px_12px_rgba(0,0,0,0.22)]", LINE)}>
        <div className="flex">
          {(
            [
              ["0", "/5", "Today"],
              ["3", "", "Minutes"],
              ["3", "", "Calls"],
            ] as const
          ).map(([value, suffix, name], i) => (
            <div key={name} className={cn("flex-1 text-center", i > 0 && cn("border-l", LINE))}>
              <p className="text-[22.6px] font-bold leading-[26px] text-white">
                {value}
                {suffix ? <span className="text-[13px] font-semibold text-[var(--vt-muted)]">{suffix}</span> : null}
              </p>
              <p className={cn(sectionLabel, "mt-1.5")}>{name}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", PANEL)} />
          ))}
        </div>
        <p className="mt-2.5 text-[9.6px] text-[var(--vt-muted)]">5 of 5 calls left today</p>
      </div>

      <Radar />
    </div>
  );
}

/* ─── Members Chat ─── */

type MockChatMessage = {
  id: string;
  author: string;
  initials: string;
  time: string;
  body: string;
  own?: boolean;
  online?: boolean;
  reactions?: Array<{ emoji: string; count: number; mine?: boolean }>;
};

const CHAT_MESSAGES: MockChatMessage[] = [
  {
    id: "msg-1",
    author: "Alex M.",
    initials: "AM",
    time: "08:14",
    online: true,
    body: "XAU/USD holding $4,098 nicely. Looking for a long if 15m closes strong above $4,112.",
    reactions: [
      { emoji: "🔥", count: 3 },
      { emoji: "👍", count: 2 },
    ],
  },
  {
    id: "msg-2",
    author: "Sarah K.",
    initials: "SK",
    time: "08:22",
    online: true,
    body: "GBP/USD rejected the 1.2940 supply zone ahead of CPI. Staying flat until the print.",
    reactions: [
      { emoji: "👀", count: 4 },
    ],
  },
  {
    id: "msg-3",
    author: "You",
    initials: "U",
    time: "08:31",
    own: true,
    body: "Agreed on gold. Sized 0.36 lots with a 22 pip stop below the London low.",
    reactions: [
      { emoji: "🚀", count: 5, mine: true },
    ],
  },
];

function ChatMock() {
  return (
    <div className="flex h-full flex-col">
      {/* Subline below header */}
      <div className="-mt-1 flex items-center gap-1.5 px-[15px] pb-2">
        <span className="size-1.5 rounded-full bg-[var(--vt-green)]" />
        <span className="text-[9.4px] font-semibold text-[var(--vt-green)]">14 online</span>
        <span className="text-[9.4px] text-[var(--vt-muted)]">· Pro community</span>
      </div>

      {/* Pinned prompt card */}
      <div className="mx-[15px] mb-2 rounded-xl border border-white/10 bg-[#0C1037]/80 px-3 py-2 shadow-sm">
        <div className="mb-0.5 flex items-center gap-1.5">
          <Pin className="size-2.5 text-[var(--vt-blue)]" strokeWidth={2.5} aria-hidden />
          <span className="text-[8.5px] font-bold uppercase tracking-[1px] text-[var(--vt-muted)]">
            Pinned prompt
          </span>
        </div>
        <p className="text-[10.5px] leading-[14px] text-[#C8D0E7]">
          London session open: What pairs are you watching this morning? Drop your key levels below.
        </p>
      </div>

      {/* Scrollable messages */}
      <div className="ask-scrollbar flex-1 space-y-3 overflow-y-auto px-[15px] py-1">
        {/* Day separator */}
        <div className="flex justify-center">
          <span className="rounded-full bg-[var(--vt-card)] px-2.5 py-0.5 text-[9px] font-semibold text-[var(--vt-muted)]">
            Today
          </span>
        </div>

        {CHAT_MESSAGES.map((msg) => {
          if (msg.own) {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-none bg-[var(--vt-coral)] px-3 py-2 text-[12px] leading-[16px] text-white shadow-[0_4px_16px_rgba(242,109,109,0.25)]">
                  {msg.body}
                </div>
                {msg.reactions ? (
                  <div className="mt-1 flex gap-1">
                    {msg.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--vt-blue)]/50 bg-[var(--vt-blue)]/20 px-1.5 py-0.5 text-[9px] text-white"
                      >
                        <span>{r.emoji}</span>
                        <span className="font-semibold">{r.count}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <span className="mr-1 mt-0.5 text-[8.5px] text-[#5F6690]">{msg.time}</span>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-2">
              {/* Avatar with online dot */}
              <div className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#151a4a] text-[10px] font-bold text-white">
                {msg.initials}
                {msg.online ? (
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-[var(--vt-navy)] bg-[var(--vt-green)]" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-[10px] font-medium text-white">{msg.author}</span>
                  <span className="text-[8.5px] text-[#5F6690]">{msg.time}</span>
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-none border border-white/10 bg-[var(--vt-card)] px-3 py-2 text-[12px] leading-[16px] text-[#C8D0E7]">
                  {msg.body}
                </div>
                {msg.reactions ? (
                  <div className="mt-1 flex gap-1">
                    {msg.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-[var(--vt-card)] px-1.5 py-0.5 text-[9px] text-[#C8D0E7]"
                      >
                        <span>{r.emoji}</span>
                        <span className="font-semibold text-white">{r.count}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat composer */}
      <div className="px-3 pb-2 pt-1.5">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(17,22,72,0.88)] px-2.5 py-1.5 backdrop-blur-xl">
          <span className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-[var(--vt-muted)]">
            <ImagePlus className="size-4" aria-hidden />
          </span>
          <input
            type="text"
            readOnly
            placeholder="Message the members…"
            className="min-w-0 flex-1 cursor-pointer bg-transparent text-[12px] text-white caret-transparent outline-none placeholder:text-[var(--vt-muted)]"
          />
          <span className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--vt-blue)] text-white shadow-sm">
            <ArrowUp className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Body of a Pro screen, below its header. */
export function ProScreenBody({
  screen,
  onSelectScreen,
}: {
  screen: ProScreen;
  onSelectScreen?: (screen: DemoScreen) => void;
}) {
  return (
    <div className="relative z-10 min-h-0 flex-1 overflow-hidden text-left">
      {screen === "markets" || screen === "calendar" ? (
        <MarketsBody
          tab={screen === "calendar" ? "Economic" : "Intelligence"}
          onSelectScreen={onSelectScreen}
        />
      ) : null}
      {screen === "journal" ? <JournalMock /> : null}
      {screen === "mind" ? <MindMock /> : null}
      {screen === "chat" ? <ChatMock /> : null}
    </div>
  );
}
