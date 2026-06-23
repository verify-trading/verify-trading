/**
 * Self-contained mini answer cards for the hero demo. Visual language matches
 * the real Ask cards (src/components/ask/cards.tsx) — same frame, accents, and
 * stat tiles — but sized compactly to read as a real phone-app screen, with no
 * dependency on the live RAG contracts or charts.
 */

import { memo } from "react";

import type {
  DemoBriefingCard,
  DemoBrokerCard,
  DemoCalcCard,
  DemoCard,
} from "./types";

function CardFrame({
  eyebrow,
  accentClassName,
  trailing,
  children,
}: {
  eyebrow: string;
  accentClassName: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-[16px_16px_16px_5px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] shadow-[0_10px_34px_rgba(10,13,46,0.35)]">
      <div
        className={`flex min-w-0 items-center justify-between gap-2 border-b border-[color:var(--vt-border)] px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] ${accentClassName}`}
      >
        <span>{eyebrow}</span>
        {trailing}
      </div>
      <div className="min-w-0 p-2.5">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--vt-card-alt)] p-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--vt-muted)]">
        {label}
      </div>
      <div className={`mt-0.5 break-words text-[12px] font-bold ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const w = 100;
  const h = 28;
  const stroke = up ? "var(--vt-green)" : "var(--vt-coral)";
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, h - p * (h - 4) - 2] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="demo-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#demo-spark)" />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BrokerCardView({ card }: { card: DemoBrokerCard }) {
  const accent = card.color === "green" ? "var(--vt-green)" : "var(--vt-coral)";
  const accentClassName =
    card.color === "green" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]";
  const score = Number.parseFloat(card.score);

  return (
    <CardFrame
      eyebrow="Broker Check"
      accentClassName={accentClassName}
      trailing={<span>{card.status}</span>}
    >
      <div className="space-y-2.5">
        <div>
          <div className="text-[15px] font-black leading-tight text-white">
            {card.name}
          </div>
          {card.source ? (
            <div className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
              {card.source}
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between text-[12px] text-[var(--vt-muted)]">
            <span>Trust Score</span>
            <span className="text-[13px] font-black" style={{ color: accent }}>
              {card.score} / 10
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${score * 10}%`, backgroundColor: accent }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile
            label="FCA"
            value={card.fca}
            valueClassName={
              card.fca === "Yes" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"
            }
          />
          <StatTile label="Complaints" value={card.complaints} />
        </div>
        <div className="border-t border-white/[0.06] pt-2.5">
          <p className="text-[12px] leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

function BriefingCardView({ card }: { card: DemoBriefingCard }) {
  const isUp = card.direction === "up";
  return (
    <CardFrame
      eyebrow="Market Briefing"
      accentClassName="text-[var(--vt-blue)]"
      trailing={
        <span className="inline-flex items-center gap-1 text-[var(--vt-green)]">
          <span className="size-1.5 rounded-full bg-[var(--vt-green)]" />
          Live
        </span>
      }
    >
      <div className="space-y-2.5">
        <div className="flex min-w-0 items-end gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--vt-muted)]">
              {card.asset}
            </div>
            <div className="mt-1 break-words text-xl font-black tracking-[-0.04em] text-white">
              {card.price}
            </div>
          </div>
          <div
            className={`shrink-0 pb-0.5 text-[11px] font-bold ${
              isUp ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"
            }`}
          >
            {isUp ? "▲" : "▼"} {card.change}
          </div>
        </div>
        <Sparkline points={card.series} up={isUp} />
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile
            label="Resistance"
            value={card.level1}
            valueClassName="text-[var(--vt-coral)]"
          />
          <StatTile
            label="Support"
            value={card.level2}
            valueClassName="text-[var(--vt-green)]"
          />
        </div>
        {card.event ? (
          <div className="rounded-lg border border-[rgba(242,109,109,0.25)] bg-[rgba(242,109,109,0.08)] px-2.5 py-2 text-[11px] font-semibold leading-snug text-[var(--vt-coral)]">
            {card.event}
          </div>
        ) : null}
        <div className="border-t border-white/[0.06] pt-2.5">
          <p className="text-[12px] leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

function CalcCardView({ card }: { card: DemoCalcCard }) {
  return (
    <CardFrame eyebrow="Position Size" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-2.5">
        <div className="rounded-2xl bg-[var(--vt-coral)] px-3 py-3 text-center">
          <div className="text-3xl font-black tracking-[-0.06em] text-white">
            {card.lots}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-white/80">lots</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <StatTile label="Account" value={card.account} />
          <StatTile label="Risk" value={card.risk} />
          <StatTile label="SL" value={card.sl} />
        </div>
        <div className="border-t border-white/[0.06] pt-2.5">
          <p className="text-[12px] leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

// Memoized: during the per-character typing of the *next* question, the parent
// re-renders ~15-30×/s but the card props (module-constant data) never change.
export const DemoAnswerCard = memo(function DemoAnswerCard({
  card,
}: {
  card: DemoCard;
}) {
  switch (card.type) {
    case "broker":
      return <BrokerCardView card={card} />;
    case "briefing":
      return <BriefingCardView card={card} />;
    case "calc":
      return <CalcCardView card={card} />;
    default:
      return null;
  }
});
