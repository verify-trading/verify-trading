import { InteractiveMarketMiniChart, InteractiveProjectionCurve } from "@/components/ask/ask-charts";
import type { AskCard, AskUiMeta } from "@/lib/ask/contracts";

function formatDisplayMoney(value: number, currencySymbol?: string) {
  const symbol = currencySymbol ?? "£";
  const rounded = Number(value.toFixed(2));
  const hasDecimals = Math.abs(rounded % 1) > Number.EPSILON;
  const formatted = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });

  return `${symbol}${formatted}`;
}

function CardFrame({
  eyebrow,
  accentClassName,
  children,
  trailing,
}: {
  eyebrow: string;
  accentClassName: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[min(100%,24rem)] overflow-hidden rounded-[20px_20px_20px_6px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] shadow-[0_12px_40px_rgba(10,13,46,0.35)]">
      <div
        className={`flex min-w-0 items-center justify-between gap-2 border-b border-[color:var(--vt-border)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] sm:px-4 sm:py-3 sm:text-[11px] ${accentClassName}`}
      >
        <span>{eyebrow}</span>
        {trailing}
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function BrokerCard({
  card,
  uiMeta,
}: {
  card: Extract<AskCard, { type: "broker" }>;
  uiMeta?: AskUiMeta;
}) {
  const accent = card.color === "green" ? "var(--vt-green)" : "var(--vt-coral)";
  const scoreWidth = `${Math.max(0, Math.min(100, Number.parseFloat(card.score) * 10))}%`;
  const isPropFirm = uiMeta?.verificationKind === "propfirm";
  const eyebrow = isPropFirm ? "Firm Check" : "Broker Check";
  const primaryLabel = isPropFirm ? "Type" : "FCA";
  const primaryValue = isPropFirm ? "Prop Firm" : card.fca;
  const primaryClassName = isPropFirm
    ? "text-white"
    : card.fca === "Yes"
      ? "text-[var(--vt-green)]"
      : "text-[var(--vt-coral)]";

  return (
    <CardFrame
      eyebrow={eyebrow}
      accentClassName={card.color === "green" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}
      trailing={<span>{card.status}</span>}
    >
      <div className="space-y-4">
        <div>
          <div className="text-lg font-black text-white sm:text-xl">{card.name}</div>
          {uiMeta?.verificationSourceLabel ? (
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {uiMeta.verificationSourceLabel}
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--vt-muted)]">
            <span>Trust Score</span>
            <span className="font-black" style={{ color: accent }}>
              {card.score} / 10
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full"
              style={{ width: scoreWidth, backgroundColor: accent }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {primaryLabel}
            </div>
            <div className={`mt-1 break-words text-sm font-bold ${primaryClassName}`}>
              {primaryValue}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              Complaints
            </div>
            <div className="mt-1 break-words text-sm font-bold text-white">{card.complaints}</div>
          </div>
        </div>
        <div
          className="rounded-2xl border px-3 py-3 text-sm font-semibold"
          style={{
            borderColor: `${accent}55`,
            backgroundColor: `${accent}1A`,
            color: accent,
          }}
        >
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function BriefingCard({
  card,
  uiMeta,
}: {
  card: Extract<AskCard, { type: "briefing" }>;
  uiMeta?: AskUiMeta;
}) {
  const isUp = card.direction === "up";
  return (
    <CardFrame
      eyebrow="Market Briefing"
      accentClassName="text-[var(--vt-blue)]"
      trailing={<span className="text-[var(--vt-green)]">Live</span>}
    >
      <div className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-end gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {card.asset}
            </div>
            <div className="mt-2 break-words text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">
              {card.price}
            </div>
          </div>
          <div
            className={`min-w-0 shrink-0 pb-0.5 text-xs font-bold sm:pb-1 sm:text-sm ${
              isUp ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"
            }`}
          >
            {isUp ? "▲" : "▼"} {card.change}
          </div>
        </div>
        {uiMeta?.marketSeries ? (
          <InteractiveMarketMiniChart points={uiMeta.marketSeries} up={isUp} />
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {uiMeta?.marketLevelScopeLabel ? `${uiMeta.marketLevelScopeLabel} Resistance` : "Resistance"}
            </div>
            <div className="mt-1 break-words text-sm font-bold text-[var(--vt-coral)]">{card.level1}</div>
          </div>
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {uiMeta?.marketLevelScopeLabel ? `${uiMeta.marketLevelScopeLabel} Support` : "Support"}
            </div>
            <div className="mt-1 break-words text-sm font-bold text-[var(--vt-green)]">{card.level2}</div>
          </div>
        </div>
        {card.event ? (
          <div className="rounded-2xl border border-[rgba(242,109,109,0.25)] bg-[rgba(242,109,109,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-coral)]">
            {card.event}
          </div>
        ) : null}
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function CalcCard({ card }: { card: Extract<AskCard, { type: "calc" }> }) {
  return (
    <CardFrame eyebrow="Position Size" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div className="rounded-3xl bg-[var(--vt-coral)] px-3 py-4 text-center sm:px-4 sm:py-5">
          <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">{card.lots}</div>
          <div className="mt-1 text-sm font-semibold text-white/80">lots</div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Account", card.account],
            ["Risk", card.risk_pct],
            ["SL", `${card.sl_pips} pips`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function GuruCard({ card }: { card: Extract<AskCard, { type: "guru" }> }) {
  const accent = card.color === "green" ? "var(--vt-green)" : "var(--vt-coral)";
  const scoreWidth = `${Math.max(0, Math.min(100, Number.parseFloat(card.score) * 10))}%`;

  return (
    <CardFrame
      eyebrow="Guru Check"
      accentClassName={card.color === "green" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"}
      trailing={<span>{card.status}</span>}
    >
      <div className="space-y-4">
        <div>
          <div className="text-lg font-black text-white sm:text-xl">{card.name}</div>
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--vt-muted)]">
            <span>Trust Score</span>
            <span className="font-black" style={{ color: accent }}>
              {card.score} / 10
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full"
              style={{ width: scoreWidth, backgroundColor: accent }}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
            Verified
          </div>
          <div className="mt-1 break-words text-sm font-bold text-white">{card.verified}</div>
        </div>
        <div
          className="rounded-2xl border px-3 py-3 text-sm font-semibold"
          style={{
            borderColor: `${accent}55`,
            backgroundColor: `${accent}1A`,
            color: accent,
          }}
        >
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function InsightCard({ card }: { card: Extract<AskCard, { type: "insight" }> }) {
  return (
    <CardFrame eyebrow="Trading Insight" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div className="text-lg font-black tracking-[-0.04em] text-white sm:text-xl">
          {card.headline}
        </div>
        <p className="text-sm leading-relaxed text-slate-200 sm:leading-7">{card.body}</p>
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function ChartAnalysisCard({ card }: { card: Extract<AskCard, { type: "chart" }> }) {
  return (
    <CardFrame eyebrow="Chart Analysis" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Pattern", card.pattern],
            ["Bias", card.bias],
            ["Entry", card.entry],
            ["Stop", card.stop],
            ["Target", card.target],
            ["R:R", card.rr],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          Confidence: {card.confidence}
        </div>
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function SetupCardView({ card }: { card: Extract<AskCard, { type: "setup" }> }) {
  return (
    <CardFrame eyebrow="Trade Setup" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div>
          <div className="text-lg font-black text-white sm:text-xl">{card.asset}</div>
          <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {card.bias} bias
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Entry", card.entry],
            ["Stop", card.stop],
            ["Target", card.target],
            ["R:R", card.rr],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-sm leading-relaxed text-slate-200">
          {card.rationale}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          Confidence: {card.confidence}
        </div>
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function PlanCardView({ card }: { card: Extract<AskCard, { type: "plan" }> }) {
  return (
    <CardFrame eyebrow="Growth Plan" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Start", formatDisplayMoney(card.startBalance, card.currencySymbol)],
            ["Top Up", formatDisplayMoney(card.monthlyAdd, card.currencySymbol)],
            ["Daily", card.dailyTarget],
            ["Weekly", card.weeklyTarget],
            ["Monthly", card.monthlyTarget],
            ["Max Daily Loss", card.maxDailyLoss],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          {card.projectionMonths}-month base-case projection:{" "}
          {formatDisplayMoney(card.projectedBalance, card.currencySymbol)} ({card.projectionReturn})
        </div>
        <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-sm leading-relaxed text-slate-200">
          {card.rationale}
        </div>
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

function ProjectionCardView({
  card,
  uiMeta,
}: {
  card: Extract<AskCard, { type: "projection" }>;
  uiMeta?: AskUiMeta;
}) {
  return (
    <CardFrame eyebrow="Projection Engine" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <InteractiveProjectionCurve card={card} markers={uiMeta?.projectionMarkers} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Start", formatDisplayMoney(card.startBalance, card.currencySymbol)],
            ["Top Up", formatDisplayMoney(card.monthlyAdd, card.currencySymbol)],
            ["Months", `${card.months}`],
            ["Loss Events", `${card.lossEvents}`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          Projected balance: {formatDisplayMoney(card.projectedBalance, card.currencySymbol)} ({card.totalReturn})
        </div>
        <div className="rounded-2xl border border-[color:var(--vt-border)] bg-[rgba(76,110,245,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-blue)]">
          {card.verdict}
        </div>
      </div>
    </CardFrame>
  );
}

export function AskResponseCard({
  card,
  uiMeta,
}: {
  card: AskCard;
  uiMeta?: AskUiMeta;
}) {
  let content: React.ReactNode;

  switch (card.type) {
    case "broker":
      content = <BrokerCard card={card} uiMeta={uiMeta} />;
      break;
    case "briefing":
      content = <BriefingCard card={card} uiMeta={uiMeta} />;
      break;
    case "calc":
      content = <CalcCard card={card} />;
      break;
    case "guru":
      content = <GuruCard card={card} />;
      break;
    case "chart":
      content = <ChartAnalysisCard card={card} />;
      break;
    case "setup":
      content = <SetupCardView card={card} />;
      break;
    case "plan":
      content = <PlanCardView card={card} />;
      break;
    case "projection":
      content = <ProjectionCardView card={card} uiMeta={uiMeta} />;
      break;
    default:
      content = <InsightCard card={card} />;
  }

  return <div>{content}</div>;
}
