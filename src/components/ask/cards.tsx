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
    <div className="w-full max-w-[20rem] overflow-hidden rounded-[20px_20px_20px_6px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] shadow-[0_12px_40px_rgba(10,13,46,0.35)] sm:max-w-md">
      <div
        className={`flex min-w-0 items-center justify-between gap-2 border-b border-[color:var(--vt-border)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] sm:px-4 sm:py-3 sm:text-[11px] ${accentClassName}`}
      >
        <span>{eyebrow}</span>
        {trailing}
      </div>
      <div className="min-w-0 p-3 sm:p-3.5">{children}</div>
    </div>
  );
}

/** Compact review count, e.g. 21000 -> "21k". */
function formatReviewCount(count: number): string {
  return count >= 1000 ? `${Math.round(count / 1000)}k` : String(count);
}

/** "2026-07-08" → "Jul 8"; anything unparseable renders as-is. */
function formatAsOfDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A non-numeric score (e.g. "Provisional") shows the label only — a bar would render a NaN width. */
function TrustScoreBar({ score, accent }: { score: string; accent: string }) {
  const numericScore = Number.parseFloat(score);
  const isNumeric = Number.isFinite(numericScore);

  return (
    <>
      <div className="mt-3 flex items-center justify-between text-sm text-[var(--vt-muted)]">
        <span>Trust Score</span>
        <span className="font-black" style={{ color: accent }}>
          {isNumeric ? `${score} / 10` : score}
        </span>
      </div>
      {isNumeric ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, numericScore * 10))}%`, backgroundColor: accent }}
          />
        </div>
      ) : null}
    </>
  );
}

function BrokerCard({
  card,
  uiMeta,
}: {
  card: Extract<AskCard, { type: "broker" }>;
  uiMeta?: AskUiMeta;
}) {
  const isPropFirm = uiMeta?.verificationKind === "propfirm";
  // Prop firms span five trust bands, so the two middle ones read as amber rather
  // than the same coral as Avoid/closed — a mid-trust firm shouldn't look defunct.
  const propBand = uiMeta?.propFirm?.band;
  const propCaution =
    isPropFirm && (propBand === "Proceed With Caution" || propBand === "High Risk");
  const accent =
    card.color === "green" ? "var(--vt-green)" : propCaution ? "var(--vt-amber)" : "var(--vt-coral)";
  const accentClassName =
    card.color === "green"
      ? "text-[var(--vt-green)]"
      : propCaution
        ? "text-[var(--vt-amber)]"
        : "text-[var(--vt-coral)]";
  const eyebrow = isPropFirm ? "Firm Check" : "Broker Check";
  const primaryLabel = isPropFirm ? "Type" : "FCA";
  const primaryValue = isPropFirm ? "Prop Firm" : card.fca;
  const primaryClassName = isPropFirm
    ? "text-white"
    : card.fca === "Yes"
      ? "text-[var(--vt-green)]"
      : "text-[var(--vt-coral)]";

  const propFirm = uiMeta?.propFirm;
  const notRated = propFirm?.notRated ?? false;
  const curatedFacts = Boolean(
    propFirm?.confirmedFacts?.length || propFirm?.unconfirmedClaims?.length,
  );
  // Research still developing: the card shows curated evidence and withholds a
  // score, so every trust cue reads "insufficient data", never "rated". The
  // server computes this once (uiMeta.propFirm.developing); the local derivation
  // is only a fallback for messages persisted before that flag existed.
  const developing =
    isPropFirm &&
    (propFirm?.developing ?? (Boolean(propFirm?.researchStatus) || curatedFacts));
  // One score view for the whole card, instead of threading two flags through
  // stacked ternaries below.
  const scoreView: "developing" | "notRated" | "scored" = developing
    ? "developing"
    : notRated
      ? "notRated"
      : "scored";
  const trailingLabel = developing
    // Split only on em/en dash — NOT a plain hyphen, which would truncate hyphenated
    // words like "Pre-revenue" to "Pre".
    ? propFirm?.researchStatus?.split(/[—–]/)[0]?.trim() || "Developing"
    : isPropFirm && propFirm?.band
      ? propFirm.band
      : card.status;
  const trustpilot =
    propFirm?.trustpilotRating !== undefined
      ? `${propFirm.trustpilotRating.toFixed(1)}${
          propFirm.trustpilotCount ? ` (${formatReviewCount(propFirm.trustpilotCount)})` : ""
        }`
      : "—";

  return (
    <CardFrame
      eyebrow={eyebrow}
      accentClassName={accentClassName}
      trailing={<span>{trailingLabel}</span>}
    >
      <div className="space-y-4">
        <div>
          <div className="text-lg font-black text-white sm:text-xl">{card.name}</div>
          {uiMeta?.verificationSourceLabel ? (
            <div className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {uiMeta.verificationSourceLabel}
            </div>
          ) : null}
          {scoreView === "developing" ? (
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-bold">
              <span className="text-[var(--vt-muted)]">Trust Score</span>
              <span className="text-[var(--vt-amber)]">Insufficient verified data</span>
            </div>
          ) : scoreView === "notRated" ? (
            <div className="mt-3 text-sm font-bold text-[var(--vt-muted)]">Not yet rated</div>
          ) : (
            <TrustScoreBar score={card.score} accent={accent} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {primaryLabel}
            </div>
            <div className={`mt-1 break-words text-sm font-bold ${primaryClassName}`}>
              {primaryValue}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] p-3 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {isPropFirm ? "Trustpilot" : "Complaints"}
            </div>
            <div className="mt-1 break-words text-sm font-bold text-white">
              {isPropFirm ? trustpilot : card.complaints}
            </div>
            {isPropFirm && propFirm?.trustpilotDate ? (
              <div className="mt-1 text-[10px] text-[var(--vt-muted)]">as of {formatAsOfDate(propFirm.trustpilotDate)}</div>
            ) : null}
          </div>
        </div>
        {isPropFirm && curatedFacts && propFirm ? (
          <div className="space-y-4 border-t border-white/[0.06] pt-3">
            {propFirm.confirmedFacts?.length ? (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-green)]">Confirmed</h3>
                <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-200">
                  {propFirm.confirmedFacts.map((fact) => (
                    <li key={fact.text} className="flex gap-2">
                      <span className="mt-1 text-[var(--vt-green)]" aria-hidden>•</span>
                      <span>
                        {fact.text}{" "}
                        {fact.sourceUrl ? (
                          <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--vt-muted)] underline underline-offset-2">
                            [{fact.sourceLabel ?? "Source"}]
                          </a>
                        ) : fact.sourceLabel ? (
                          <span className="text-[var(--vt-muted)]">[{fact.sourceLabel}]</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {propFirm.unconfirmedClaims?.length ? (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-amber)]">Not confirmed — do not treat as fact</h3>
                <ul className="mt-2 space-y-2 text-sm italic leading-relaxed text-[var(--vt-muted)]">
                  {propFirm.unconfirmedClaims.map((claim) => (
                    <li key={claim} className="flex gap-2"><span className="mt-1 text-[var(--vt-amber)]" aria-hidden>•</span><span>{claim}</span></li>
                  ))}
                </ul>
              </section>
            ) : null}
            {propFirm.reverifyTrigger ? <p className="text-center text-xs leading-relaxed text-[var(--vt-muted)]">{propFirm.reverifyTrigger}</p> : null}
          </div>
        ) : (
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
          </div>
        )}
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
  const level1Label =
    uiMeta?.marketLevelScopeLabel === "Recent range"
      ? "Recent range high"
      : uiMeta?.marketLevelScopeLabel
        ? `${uiMeta.marketLevelScopeLabel} Resistance`
        : "Resistance";
  const level2Label =
    uiMeta?.marketLevelScopeLabel === "Recent range"
      ? "Recent range low"
      : uiMeta?.marketLevelScopeLabel
        ? `${uiMeta.marketLevelScopeLabel} Support`
        : "Support";
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
          <InteractiveMarketMiniChart points={uiMeta.marketSeries} up={isUp} asset={card.asset} />
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {level1Label}
            </div>
            <div className="mt-1 break-words text-sm font-bold text-[var(--vt-coral)]">{card.level1}</div>
          </div>
          <div className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] p-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
              {level2Label}
            </div>
            <div className="mt-1 break-words text-sm font-bold text-[var(--vt-green)]">{card.level2}</div>
          </div>
        </div>
        {card.event ? (
          <div className="rounded-xl border border-[rgba(242,109,109,0.25)] bg-[rgba(242,109,109,0.08)] px-3 py-2.5 text-xs font-semibold leading-snug text-[var(--vt-coral)] sm:text-sm">
            {card.event}
          </div>
        ) : null}
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
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
              className="min-w-0 rounded-2xl bg-[var(--vt-card-alt)] p-3 text-center"
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
                {label}
              </div>
              <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

// Gurus are named individuals: Unverified is a neutral default (never styled as a
// warning), Caution is shown only with its regulatory citation, Verified is earned.
const GURU_TIER_STYLE = {
  Verified: { accent: "text-[var(--vt-green)]" },
  Unverified: { accent: "text-[var(--vt-muted)]" },
  Caution: { accent: "text-[var(--vt-amber)]" },
} as const;

function GuruCard({ card }: { card: Extract<AskCard, { type: "guru" }> }) {
  const accent = GURU_TIER_STYLE[card.tier].accent;

  return (
    <CardFrame eyebrow="Guru Check" accentClassName={accent} trailing={<span className={accent}>{card.tier}</span>}>
      <div className="space-y-4">
        <div className="text-lg font-black text-white sm:text-xl">{card.name}</div>
        <div className="rounded-2xl bg-[var(--vt-card-alt)] p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
            Verified track record
          </div>
          <div className="mt-1 break-words text-sm font-bold text-white">{card.trackRecord}</div>
        </div>
        {card.tier === "Caution" && card.citationUrl ? (
          <a
            href={card.citationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--vt-amber)] underline underline-offset-2"
          >
            View source →
          </a>
        ) : null}
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
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
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm font-semibold leading-relaxed text-[var(--vt-blue)]">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

function chartBiasChipClass(bias: string) {
  switch (bias) {
    case "Bullish":
      return "border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] text-[var(--vt-green)]";
    case "Bearish":
      return "border border-[rgba(242,109,109,0.35)] bg-[rgba(242,109,109,0.1)] text-[var(--vt-coral)]";
    default:
      return "border border-white/10 bg-white/[0.05] text-[var(--vt-muted)]";
  }
}

function chartConfidenceClass(confidence: string) {
  switch (confidence) {
    case "High":
      return "text-[var(--vt-green)]";
    case "Medium":
      return "text-[var(--vt-amber)]";
    case "Low":
      return "text-[var(--vt-coral)]";
    default:
      return "text-[var(--vt-muted)]";
  }
}

/** Bias chip + R:R, the level grid, and the confidence line — shared by the chart and setup cards. */
function BiasAndRewardRow({ bias, rr }: { bias: string; rr: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span
        className={`inline-flex max-w-[min(100%,12rem)] items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] sm:max-w-none sm:text-xs ${chartBiasChipClass(bias)}`}
      >
        {bias}
      </span>
      <span className="inline-flex shrink-0 items-center rounded-full border border-[color:var(--vt-border)] bg-[var(--vt-card-alt)] px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-white sm:text-xs">
        R:R {rr}
      </span>
    </div>
  );
}

function LevelGrid({ entry, stop, target }: { entry: string; stop: string; target: string }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {(
        [
          ["Entry", entry],
          ["Stop", stop],
          ["Target", target],
        ] as const
      ).map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 rounded-xl border border-white/[0.06] bg-[var(--vt-card-alt)] px-2 py-2 text-center sm:px-2.5"
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[10px]">
            {label}
          </div>
          <div className="mt-1 font-mono text-xs font-bold tabular-nums text-white sm:text-sm">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ConfidenceRow({ confidence }: { confidence: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] sm:text-xs">
      <span className="font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)]">Confidence</span>
      <span className={`font-semibold ${chartConfidenceClass(confidence)}`}>{confidence}</span>
    </div>
  );
}

function ChartAnalysisCard({ card }: { card: Extract<AskCard, { type: "chart" }> }) {
  return (
    <CardFrame eyebrow="Chart Analysis" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-3">
        <BiasAndRewardRow bias={card.bias} rr={card.rr} />

        <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">
            Pattern
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-white">{card.pattern}</p>
        </div>

        <LevelGrid entry={card.entry} stop={card.stop} target={card.target} />
        <ConfidenceRow confidence={card.confidence} />

        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

function SetupCardView({ card }: { card: Extract<AskCard, { type: "setup" }> }) {
  return (
    <CardFrame eyebrow="Trade Setup" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-3">
        <div className="text-lg font-black tracking-[-0.03em] text-white sm:text-xl">{card.asset}</div>

        <BiasAndRewardRow bias={card.bias} rr={card.rr} />
        <LevelGrid entry={card.entry} stop={card.stop} target={card.target} />
        <ConfidenceRow confidence={card.confidence} />

        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Context</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{card.rationale}</p>
        </div>

        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Takeaway</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{card.verdict}</p>
        </div>
      </div>
    </CardFrame>
  );
}

function planStatTile(label: string, value: string) {
  return (
    <div key={label} className="min-w-0 rounded-xl border border-white/[0.06] bg-[var(--vt-card-alt)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function PlanCardView({ card }: { card: Extract<AskCard, { type: "plan" }> }) {
  return (
    <CardFrame eyebrow="Growth Plan" accentClassName="text-[var(--vt-blue)]">
      <div className="space-y-4">
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Capital</div>
          <div className="grid grid-cols-2 gap-1.5">
            {planStatTile("Start", formatDisplayMoney(card.startBalance, card.currencySymbol))}
            {planStatTile("Top Up", formatDisplayMoney(card.monthlyAdd, card.currencySymbol))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Targets</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {planStatTile("Daily", card.dailyTarget)}
            {planStatTile("Weekly", card.weeklyTarget)}
            {planStatTile("Monthly", card.monthlyTarget)}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Risk</div>
          {planStatTile("Max Daily Loss", card.maxDailyLoss)}
        </div>
        <div className="rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] px-3 py-2.5 text-xs font-semibold leading-snug text-[var(--vt-green)] sm:text-sm">
          {card.projectionMonths}-month base-case projection:{" "}
          {formatDisplayMoney(card.projectedBalance, card.currencySymbol)} ({card.projectionReturn})
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Rationale</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{card.rationale}</p>
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Takeaway</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{card.verdict}</p>
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
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--vt-muted)]">Inputs</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ["Start", formatDisplayMoney(card.startBalance, card.currencySymbol)],
              ["Top Up", formatDisplayMoney(card.monthlyAdd, card.currencySymbol)],
              ["Months", `${card.months}`],
              ["Loss Events", `${card.lossEvents}`],
            ].map(([label, value]) => planStatTile(label, value))}
          </div>
        </div>
        <div className="rounded-xl border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] px-3 py-2.5 text-xs font-semibold leading-snug text-[var(--vt-green)] sm:text-sm">
          Projected balance: {formatDisplayMoney(card.projectedBalance, card.currencySymbol)} ({card.totalReturn})
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <p className="text-sm leading-relaxed text-slate-200">{card.verdict}</p>
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
  switch (card.type) {
    case "broker":
      return <BrokerCard card={card} uiMeta={uiMeta} />;
    case "briefing":
      return <BriefingCard card={card} uiMeta={uiMeta} />;
    case "calc":
      return <CalcCard card={card} />;
    case "guru":
      return <GuruCard card={card} />;
    case "chart":
      return <ChartAnalysisCard card={card} />;
    case "setup":
      return <SetupCardView card={card} />;
    case "plan":
      return <PlanCardView card={card} />;
    case "projection":
      return <ProjectionCardView card={card} uiMeta={uiMeta} />;
    default:
      return <InsightCard card={card} />;
  }
}
