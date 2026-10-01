"use client";

import { useState, type ReactNode } from "react";

import {
  ACCOUNT_CURRENCIES,
  TOOL_PAIRS,
  breakEvenWinRate,
  marginRequired,
  needsPrice,
  needsQuoteRate,
  pipValuePerLot,
  riskReward,
  sizePosition,
} from "@/lib/marketing/tools";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[var(--vt-card-alt)] px-3.5 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-[var(--vt-blue)]";

const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-[var(--vt-muted)]">{hint}</span> : null}
    </label>
  );
}

function Num({ label, value, onChange, hint, step }: { label: string; value: string; onChange: (v: string) => void; hint?: string; step?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" inputMode="decimal" min="0" step={step ?? "any"} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </Field>
  );
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function Hero({ value, unit, tone = "coral" }: { value: string; unit: string; tone?: "coral" | "green" | "amber" }) {
  const bg = tone === "green" ? "bg-[var(--vt-green)]" : tone === "amber" ? "bg-[var(--vt-amber)]" : "bg-[var(--vt-coral)]";
  return (
    <div role="status" aria-live="polite" className={cn("rounded-2xl px-5 py-6 text-center shadow-lg", bg)}>
      <div className="text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/90">{unit}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] px-3.5 py-3 border border-white/[0.06]">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">{label}</div>
      <div className="mt-0.5 break-words text-sm font-bold text-white">{value}</div>
    </div>
  );
}

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="w-full rounded-2xl border border-white/[0.08] bg-[var(--vt-card)] p-5 shadow-2xl sm:p-7">{children}</div>
);

const Hint = ({ children }: { children: ReactNode }) => (
  <p role="status" className="rounded-xl border border-[var(--vt-amber)]/30 bg-[var(--vt-amber)]/[0.07] p-4 text-sm leading-relaxed text-slate-200">{children}</p>
);

const money = (n: number, cur: string) => `${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

/* ─── Position size ─── */
export function PositionSizeCalculator() {
  const [account, setAccount] = useState("10000");
  const [cur, setCur] = useState("USD");
  const [risk, setRisk] = useState("1");
  const [stop, setStop] = useState("20");
  const [pair, setPair] = useState("EUR/USD");
  const [price, setPrice] = useState("1.0850");
  const [rate, setRate] = useState("");
  const [override, setOverride] = useState("");

  const pv = override ? { pipValue: num(override) } : pipValuePerLot({ pair, account: cur, price: num(price), quoteToAccountRate: num(rate) });
  const r = pv ? sizePosition({ accountSize: num(account), riskPercent: num(risk), stopPips: num(stop), pipValuePerLot: pv.pipValue }) : null;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Num label={`Account size (${cur})`} value={account} onChange={setAccount} />
          <Pick label="Account currency" value={cur} onChange={setCur} options={ACCOUNT_CURRENCIES} />
          <Num label="Risk per trade (%)" value={risk} onChange={setRisk} step="0.1" />
          <Num label="Stop loss (pips)" value={stop} onChange={setStop} />
          <div className="sm:col-span-2">
            <Pick label="Currency pair" value={pair} onChange={setPair} options={TOOL_PAIRS} />
          </div>
          {needsPrice(pair, cur) ? <Num label={`${pair} price`} value={price} onChange={setPrice} hint="Needed to convert the pip value." /> : null}
          {needsQuoteRate(pair, cur) ? <Num label={`1 ${pair.split("/")[1]} in ${cur}`} value={rate} onChange={setRate} hint="Conversion rate, from your broker." /> : null}
          <div className="sm:col-span-2">
            <Num label="Pip value per lot (optional)" value={override} onChange={setOverride} hint={`Overrides the pair. In ${cur}.`} />
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-5">
          {r ? (
            <>
              <Hero value={r.lots.toFixed(2)} unit="standard lots" />
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Risk amount" value={money(r.riskAmount, cur)} />
                <Stat label="Pip value / lot" value={money(pv!.pipValue, cur)} />
                <Stat label="Units" value={Math.round(r.units).toLocaleString("en-GB")} />
                <Stat label="Micro lots" value={(r.lots * 100).toFixed(1)} />
              </div>
            </>
          ) : (
            <Hint>Enter your account size, risk, stop distance and pair to see the lot size.</Hint>
          )}
          <p className="text-xs leading-relaxed text-[var(--vt-muted)]">Planning figure. Spread, slippage and broker lot steps shift real risk.</p>
        </div>
      </div>
    </Shell>
  );
}

/* ─── Risk / reward ─── */
export function RiskRewardCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [dir, setDir] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState("1.0850");
  const [stop, setStop] = useState("1.0820");
  const [target, setTarget] = useState("1.0940");
  const r = riskReward({ pair, direction: dir, entry: num(entry), stop: num(stop), target: num(target) });
  const tone = r.ok ? (r.ratio >= 2 ? "green" : r.ratio >= 1 ? "amber" : "coral") : "coral";
  const dp = pair.endsWith("JPY") ? 3 : 5;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="Currency pair" value={pair} onChange={setPair} options={TOOL_PAIRS} />
          <Pick label="Direction" value={dir} onChange={(v) => setDir(v as "long" | "short")} options={["long", "short"]} />
          <div className="sm:col-span-2">
            <Num label="Entry price" value={entry} onChange={setEntry} />
          </div>
          <Num label="Stop loss price" value={stop} onChange={setStop} />
          <Num label="Take profit price" value={target} onChange={setTarget} />
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-5">
          {r.ok ? (
            <>
              <Hero value={`1:${r.ratio.toFixed(2)}`} unit="risk to reward" tone={tone} />
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Risk" value={`${r.riskPips.toFixed(1)} pips`} />
                <Stat label="Reward" value={`${r.rewardPips.toFixed(1)} pips`} />
                <Stat label="Distance" value={r.riskDistance.toFixed(dp)} />
                <Stat label="Break-even" value={`${((breakEvenWinRate(r.ratio) ?? 0) * 100).toFixed(1)}%`} />
              </div>
            </>
          ) : (
            <Hint>{r.message}</Hint>
          )}
          <p className="text-xs leading-relaxed text-[var(--vt-muted)]">Break-even rate is before spread and commissions.</p>
        </div>
      </div>
    </Shell>
  );
}

/* ─── Pip value ─── */
export function PipValueCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [lots, setLots] = useState("1");
  const [cur, setCur] = useState("USD");
  const [price, setPrice] = useState("1.0850");
  const [rate, setRate] = useState("");
  const r = pipValuePerLot({ pair, lots: num(lots), account: cur, price: num(price), quoteToAccountRate: num(rate) });
  const ok = r && num(lots) > 0;

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="Currency pair" value={pair} onChange={setPair} options={TOOL_PAIRS} />
          <Num label="Lot size" value={lots} onChange={setLots} step="0.01" hint="1 = standard, 0.1 = mini" />
          <div className="sm:col-span-2">
            <Pick label="Account currency" value={cur} onChange={setCur} options={ACCOUNT_CURRENCIES} />
          </div>
          {needsPrice(pair, cur) ? <Num label={`${pair} price`} value={price} onChange={setPrice} hint="Needed to convert." /> : null}
          {needsQuoteRate(pair, cur) ? <Num label={`1 ${pair.split("/")[1]} in ${cur}`} value={rate} onChange={setRate} hint="Conversion rate, from broker." /> : null}
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-5">
          {ok ? (
            <>
              <Hero value={`${r.pipValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`} unit={`${cur} per pip`} />
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Pip size" value={String(r.pipSize)} />
                <Stat label="Units" value={(num(lots) * 100_000).toLocaleString("en-GB")} />
              </div>
            </>
          ) : (
            <Hint>Enter a lot size to calculate pip value.</Hint>
          )}
          <p className="text-xs leading-relaxed text-[var(--vt-muted)]">Pip values scale directly with traded lot units.</p>
        </div>
      </div>
    </Shell>
  );
}

/* ─── Margin ─── */
export function MarginCalculator() {
  const [pair, setPair] = useState("EUR/USD");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState("1.0850");
  const [lev, setLev] = useState("30");
  const [cur, setCur] = useState("USD");
  const [rate, setRate] = useState("");
  const base = pair.split("/")[0];
  const r = marginRequired({ pair, lots: num(lots), price: num(price), leverage: num(lev), account: cur, baseToAccountRate: num(rate) });

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="Currency pair" value={pair} onChange={setPair} options={TOOL_PAIRS} />
          <Num label="Lot size" value={lots} onChange={setLots} step="0.01" />
          <Num label="Price" value={price} onChange={setPrice} />
          <Num label="Leverage (x:1)" value={lev} onChange={setLev} hint="30 means 30:1" />
          <div className="sm:col-span-2">
            <Pick label="Account currency" value={cur} onChange={setCur} options={ACCOUNT_CURRENCIES} />
          </div>
          {cur !== base && cur !== pair.split("/")[1] ? <Num label={`1 ${base} in ${cur}`} value={rate} onChange={setRate} hint="Conversion rate, from broker." /> : null}
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-5">
          {r ? (
            <>
              <Hero value={money(r.margin, cur)} unit="margin required" />
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Leverage" value={`${num(lev)}:1`} />
                <Stat label="Margin rate" value={`${(r.marginRate * 100).toFixed(2)}%`} />
                <Stat label="Units" value={(num(lots) * 100_000).toLocaleString("en-GB")} />
              </div>
            </>
          ) : (
            <Hint>Enter lot size, price and leverage to calculate required margin.</Hint>
          )}
          <p className="text-xs leading-relaxed text-[var(--vt-muted)]">Brokers use different margin rates by instrument and entity.</p>
        </div>
      </div>
    </Shell>
  );
}
