import type { AskCard, AskUiMeta, ProjectionCard } from "@/lib/ask/contracts";

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
    <div className="max-w-[24rem] overflow-hidden rounded-[20px_20px_20px_6px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] shadow-[0_12px_40px_rgba(10,13,46,0.35)]">
      <div
        className={`flex items-center justify-between border-b border-[color:var(--vt-border)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] ${accentClassName}`}
      >
        <span>{eyebrow}</span>
        {trailing}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ProjectionCurve({
  card,
  markers,
}: {
  card: ProjectionCard;
  markers?: number[];
}) {
  const width = 280;
  const height = 110;
  const left = 6;
  const top = 8;
  const innerWidth = width - left * 2;
  const innerHeight = height - top * 2;
  const min = Math.min(...card.dataPoints);
  const max = Math.max(...card.dataPoints);
  const range = max - min || 1;
  const path = card.dataPoints
    .map((value, index) => {
      const x = left + (index / Math.max(card.dataPoints.length - 1, 1)) * innerWidth;
      const y = top + innerHeight - ((value - min) / range) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg data-testid="projection-curve" viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path
        d={`${path} L${left + innerWidth},${top + innerHeight} L${left},${top + innerHeight} Z`}
        fill="url(#projection-fill)"
      />
      <path
        d={path}
        fill="none"
        stroke="var(--vt-blue)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {markers?.map((markerIndex) => {
        const value = card.dataPoints[markerIndex];
        const x = left + (markerIndex / Math.max(card.dataPoints.length - 1, 1)) * innerWidth;
        const y = top + innerHeight - ((value - min) / range) * innerHeight;
        return (
          <circle
            key={markerIndex}
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--vt-coral)"
            stroke="var(--vt-navy)"
            strokeWidth="1.5"
          />
        );
      })}
      <defs>
        <linearGradient id="projection-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--vt-blue)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--vt-blue)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MarketMiniChart({ points, up }: { points: number[]; up: boolean }) {
  const width = 280;
  const height = 88;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / range) * (height - 10) - 5;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      data-testid="market-mini-chart"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl bg-[var(--vt-card-alt)] px-2 py-2"
    >
      <path
        d={path}
        fill="none"
        stroke={up ? "var(--vt-green)" : "var(--vt-coral)"}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
          <div className="text-xl font-black text-white">{card.name}</div>
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
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {primaryLabel}
            </div>
            <div className={`mt-1 text-sm font-bold ${primaryClassName}`}>
              {primaryValue}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              Complaints
            </div>
            <div className="mt-1 text-sm font-bold text-white">{card.complaints}</div>
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
        <div className="flex items-end gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {card.asset}
            </div>
            {uiMeta?.marketSourceLabel ? (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {uiMeta.marketSourceLabel}
              </div>
            ) : null}
            <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
              {card.price}
            </div>
          </div>
          <div
            className={`pb-1 text-sm font-bold ${
              isUp ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"
            }`}
          >
            {isUp ? "▲" : "▼"} {card.change}
          </div>
        </div>
        {uiMeta?.marketSeries ? (
          <MarketMiniChart points={uiMeta.marketSeries} up={isUp} />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {uiMeta?.marketLevelScopeLabel ? `${uiMeta.marketLevelScopeLabel} Resistance` : "Resistance"}
            </div>
            <div className="mt-1 text-sm font-bold text-[var(--vt-coral)]">{card.level1}</div>
          </div>
          <div className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
              {uiMeta?.marketLevelScopeLabel ? `${uiMeta.marketLevelScopeLabel} Support` : "Support"}
            </div>
            <div className="mt-1 text-sm font-bold text-[var(--vt-green)]">{card.level2}</div>
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
        <div className="rounded-3xl bg-[var(--vt-coral)] px-4 py-5 text-center">
          <div className="text-5xl font-black tracking-[-0.08em] text-white">{card.lots}</div>
          <div className="mt-1 text-sm font-semibold text-white/80">lots</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Account", card.account],
            ["Risk", card.risk_pct],
            ["SL", `${card.sl_pips} pips`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3 text-center"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{value}</div>
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
          <div className="text-xl font-black text-white">{card.name}</div>
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
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
            Verified
          </div>
          <div className="mt-1 text-sm font-bold text-white">{card.verified}</div>
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
        <div className="text-xl font-black tracking-[-0.04em] text-white">{card.headline}</div>
        <p className="text-sm leading-7 text-slate-200">{card.body}</p>
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
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Pattern", card.pattern],
            ["Bias", card.bias],
            ["Entry", card.entry],
            ["Stop", card.stop],
            ["Target", card.target],
            ["R:R", card.rr],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{value}</div>
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
        <ProjectionCurve card={card} markers={uiMeta?.projectionMarkers} />
        <div className="grid grid-cols-2 gap-2">
          {[
            ["Start", `£${card.startBalance.toLocaleString("en-GB")}`],
            ["Top Up", `£${card.monthlyAdd.toLocaleString("en-GB")}`],
            ["Months", `${card.months}`],
            ["Loss Events", `${card.lossEvents}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[var(--vt-card-alt)] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">
                {label}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] px-3 py-3 text-sm font-semibold text-[var(--vt-green)]">
          Projected balance: £{card.projectedBalance.toLocaleString("en-GB")} ({card.totalReturn})
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
    case "projection":
      content = <ProjectionCardView card={card} uiMeta={uiMeta} />;
      break;
    default:
      content = <InsightCard card={card} />;
  }

  return <div>{content}</div>;
}
