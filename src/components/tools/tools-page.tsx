"use client";

import {
  ChevronDown,
  Coins,
  LineChart,
  Percent,
  Scale,
  Shield,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  calculateMarginRequirement,
  calculatePipValue,
  calculatePositionSize,
  calculateProfitLoss,
  calculateRiskAmount,
  calculateRiskReward,
} from "@/lib/ask/calculators";

/* ─── Calculator registry ────────────────────────────────────── */

const CALCULATORS = [
  { id: "lot-size", label: "Lot Size", icon: Scale },
  { id: "risk-reward", label: "Risk / Reward", icon: Shield },
  { id: "pip-value", label: "Pip Value", icon: Coins },
  { id: "margin", label: "Margin", icon: Percent },
  { id: "profit-loss", label: "Profit / Loss", icon: TrendingUp },
  { id: "compound", label: "Compound Growth", icon: LineChart },
] as const;

type CalculatorId = (typeof CALCULATORS)[number]["id"];

/* ─── Shared primitives ──────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--vt-muted)] sm:text-[11px]">
        {label}
      </div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[color:var(--vt-border)] bg-[var(--vt-card-alt)] px-3.5 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-[var(--vt-blue)]";

function NumInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={inputClass}
      />
    </Field>
  );
}

function Sel({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} appearance-none pr-9`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--vt-muted)]"
        />
      </div>
    </Field>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--vt-card-alt)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${color ?? "text-white"}`}>{value}</div>
    </div>
  );
}

const PAIRS = [
  { value: "EUR/USD", label: "EUR/USD" },
  { value: "GBP/USD", label: "GBP/USD" },
  { value: "AUD/USD", label: "AUD/USD" },
  { value: "NZD/USD", label: "NZD/USD" },
  { value: "USD/JPY", label: "USD/JPY" },
  { value: "USD/CAD", label: "USD/CAD" },
  { value: "EUR/GBP", label: "EUR/GBP" },
  { value: "EUR/JPY", label: "EUR/JPY" },
];

const DIR = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

function currSym(code: string) {
  switch (code) {
    case "USD": return "$";
    case "GBP": return "£";
    case "EUR": return "€";
    case "JPY": return "¥";
    case "CAD": return "C$";
    case "AUD": return "A$";
    case "NZD": return "NZ$";
    case "CHF": return "CHF ";
    default: return `${code} `;
  }
}

function fmtMoney(amount: number, currency: string) {
  const s = currSym(currency);
  return `${s}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── 1. Lot Size ────────────────────────────────────────────── */

function LotSizeCalc() {
  const [account, setAccount] = useState(10_000);
  const [risk, setRisk] = useState(1);
  const [sl, setSl] = useState(20);
  const [pv, setPv] = useState(10);

  const riskAmt = calculateRiskAmount(account, risk);
  const result = useMemo(() => {
    if (sl <= 0 || pv <= 0) return null;
    try {
      return calculatePositionSize({ accountSize: account, riskPercent: risk, stopLossPips: sl, pipValuePerLot: pv, accountCurrency: "USD" });
    } catch { return null; }
  }, [account, risk, sl, pv]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumInput label="Account ($)" value={account} onChange={setAccount} />
        <NumInput label="Risk %" value={risk} onChange={setRisk} step={0.5} />
        <NumInput label="Stop Loss (pips)" value={sl} onChange={setSl} />
        <NumInput label="Pip Value / Lot ($)" value={pv} onChange={setPv} step={0.01} />
      </div>

      <div className="rounded-2xl bg-[var(--vt-coral)] px-5 py-6 text-center">
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          {result ? result.lots.toFixed(2) : "—"}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">lots</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Risk $" value={`$${riskAmt.toFixed(2)}`} color="text-[var(--vt-coral)]" />
        <Stat label="Pip Value" value={`$${pv.toFixed(2)}`} />
        <Stat label="Stop" value={`${sl} pips`} />
      </div>
    </>
  );
}

/* ─── 2. Risk / Reward ───────────────────────────────────────── */

function RiskRewardCalc() {
  const [dir, setDir] = useState("long");
  const [entry, setEntry] = useState(1.085);
  const [stop, setStop] = useState(1.082);
  const [tp, setTp] = useState(1.094);

  const result = useMemo(() => {
    if (entry <= 0 || stop <= 0 || tp <= 0) return null;
    try { return calculateRiskReward({ direction: dir as "long" | "short", entryPrice: entry, stopPrice: stop, targetPrice: tp }); }
    catch { return null; }
  }, [dir, entry, stop, tp]);

  const ratio = result?.ratio ?? 0;
  const heroColor = ratio >= 2 ? "bg-[var(--vt-green)]" : ratio >= 1 ? "bg-[var(--vt-amber)]" : "bg-[var(--vt-coral)]";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sel label="Direction" value={dir} onChange={setDir} options={DIR} />
        <NumInput label="Entry Price" value={entry} onChange={setEntry} step={0.001} />
        <NumInput label="Stop Loss" value={stop} onChange={setStop} step={0.001} />
        <NumInput label="Take Profit" value={tp} onChange={setTp} step={0.001} />
      </div>

      <div className={`rounded-2xl ${result ? heroColor : "bg-[var(--vt-coral)]"} px-5 py-6 text-center`}>
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          {result ? `1:${result.ratio.toFixed(2)}` : "—"}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">risk to reward</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Risk Distance" value={result ? result.riskDistance.toFixed(5) : "—"} color="text-[var(--vt-coral)]" />
        <Stat label="Reward Distance" value={result ? result.rewardDistance.toFixed(5) : "—"} color="text-[var(--vt-green)]" />
      </div>
    </>
  );
}

/* ─── 3. Pip Value ───────────────────────────────────────────── */

function PipValueCalc() {
  const [pair, setPair] = useState("EUR/USD");
  const [lots, setLots] = useState(1);

  const result = useMemo(() => {
    if (lots <= 0) return null;
    try { return calculatePipValue({ pair, lotSize: lots, contractSize: 100_000 }); }
    catch { return null; }
  }, [pair, lots]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sel label="Pair" value={pair} onChange={setPair} options={PAIRS} />
        <NumInput label="Lot Size" value={lots} onChange={setLots} step={0.01} />
      </div>

      <div className="rounded-2xl bg-[var(--vt-coral)] px-5 py-6 text-center">
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          {result ? `${currSym(result.currency)}${result.pipValue.toFixed(2)}` : "—"}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">per pip ({result?.currency ?? "—"})</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pair" value={result?.pair ?? "—"} />
        <Stat label="Pip Size" value={result ? String(result.pipSize) : "—"} />
        <Stat label="Units" value={(lots * 100_000).toLocaleString()} />
      </div>
    </>
  );
}

/* ─── 4. Margin ──────────────────────────────────────────────── */

function MarginCalc() {
  const [pair, setPair] = useState("EUR/USD");
  const [lots, setLots] = useState(1);
  const [price, setPrice] = useState(1.085);
  const [lev, setLev] = useState(30);

  const result = useMemo(() => {
    if (lots <= 0 || price <= 0 || lev <= 0) return null;
    try { return calculateMarginRequirement({ pair, lotSize: lots, price, leverage: lev, contractSize: 100_000 }); }
    catch { return null; }
  }, [pair, lots, price, lev]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sel label="Pair" value={pair} onChange={setPair} options={PAIRS} />
        <NumInput label="Lot Size" value={lots} onChange={setLots} step={0.01} />
        <NumInput label="Entry Price" value={price} onChange={setPrice} step={0.001} />
        <NumInput label="Leverage" value={lev} onChange={setLev} />
      </div>

      <div className="rounded-2xl bg-[var(--vt-coral)] px-5 py-6 text-center">
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          {result ? fmtMoney(result.marginRequired, result.currency) : "—"}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">margin required ({result?.currency ?? "—"})</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Leverage" value={`${lev}:1`} />
        <Stat label="Margin Rate" value={result ? `${(result.marginRate * 100).toFixed(2)}%` : "—"} />
        <Stat label="Notional" value={result ? fmtMoney(lots * 100_000 * price, result.currency) : "—"} />
      </div>
    </>
  );
}

/* ─── 5. Profit / Loss ───────────────────────────────────────── */

function ProfitLossCalc() {
  const [pair, setPair] = useState("EUR/USD");
  const [dir, setDir] = useState("long");
  const [entry, setEntry] = useState(1.085);
  const [exit, setExit] = useState(1.094);
  const [lots, setLots] = useState(1);

  const result = useMemo(() => {
    if (entry <= 0 || exit <= 0 || lots <= 0) return null;
    try { return calculateProfitLoss({ pair, direction: dir as "long" | "short", entryPrice: entry, exitPrice: exit, lotSize: lots, contractSize: 100_000 }); }
    catch { return null; }
  }, [pair, dir, entry, exit, lots]);

  const profit = result ? result.profitLoss >= 0 : true;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Sel label="Pair" value={pair} onChange={setPair} options={PAIRS} />
        <Sel label="Direction" value={dir} onChange={setDir} options={DIR} />
        <NumInput label="Entry Price" value={entry} onChange={setEntry} step={0.001} />
        <NumInput label="Exit Price" value={exit} onChange={setExit} step={0.001} />
      </div>
      <NumInput label="Lot Size" value={lots} onChange={setLots} step={0.01} />

      <div className={`rounded-2xl ${profit ? "bg-[var(--vt-green)]" : "bg-[var(--vt-coral)]"} px-5 py-6 text-center`}>
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          {result ? `${result.profitLoss >= 0 ? "+" : "-"}${fmtMoney(result.profitLoss, result.currency)}` : "—"}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">
          {result ? `${result.pipsMoved >= 0 ? "+" : ""}${result.pipsMoved} pips · ${result.currency}` : "profit / loss"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Direction" value={dir === "long" ? "Long" : "Short"} color={dir === "long" ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"} />
        <Stat label="Entry" value={entry.toFixed(5)} />
        <Stat label="Exit" value={exit.toFixed(5)} />
      </div>
    </>
  );
}

/* ─── 6. Compound Growth ─────────────────────────────────────── */

function CompoundCalc() {
  const [bal, setBal] = useState(10_000);
  const [rate, setRate] = useState(5);
  const [months, setMonths] = useState(12);
  const [add, setAdd] = useState(0);

  const projected = useMemo(() => {
    let b = bal;
    for (let m = 1; m <= months; m++) { b += add; b *= 1 + rate / 100; }
    return Math.round(b * 100) / 100;
  }, [bal, rate, months, add]);

  const contributed = bal + add * months;
  const net = projected - contributed;
  const ret = contributed > 0 ? ((net / contributed) * 100).toFixed(1) : "0.0";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumInput label="Starting Balance ($)" value={bal} onChange={setBal} />
        <NumInput label="Monthly % Gain" value={rate} onChange={setRate} step={0.5} />
        <NumInput label="Monthly Deposit ($)" value={add} onChange={setAdd} />
        <NumInput label="Months" value={months} onChange={setMonths} />
      </div>

      <div className="rounded-2xl bg-[var(--vt-coral)] px-5 py-6 text-center">
        <div className="text-4xl font-black tracking-[-0.08em] text-white sm:text-5xl">
          ${Math.round(projected).toLocaleString("en-US")}
        </div>
        <div className="mt-1 text-sm font-semibold text-white/80">after {months} months</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Contributed" value={`$${contributed.toLocaleString("en-US")}`} />
        <Stat label="Net Profit" value={`$${Math.round(net).toLocaleString("en-US")}`} color={net >= 0 ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"} />
        <Stat label="Return" value={`${ret}%`} color="text-[var(--vt-blue)]" />
      </div>
    </>
  );
}

/* ─── Render map ─────────────────────────────────────────────── */

function ActiveCalculator({ id }: { id: CalculatorId }) {
  switch (id) {
    case "lot-size": return <LotSizeCalc />;
    case "risk-reward": return <RiskRewardCalc />;
    case "pip-value": return <PipValueCalc />;
    case "margin": return <MarginCalc />;
    case "profit-loss": return <ProfitLossCalc />;
    case "compound": return <CompoundCalc />;
  }
}

/* ─── Page ───────────────────────────────────────────────────── */

export function ToolsPage() {
  const [active, setActive] = useState<CalculatorId>("lot-size");
  const activeMeta = CALCULATORS.find((c) => c.id === active)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="min-h-0 flex-1">
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
        {/* ── Mobile: dropdown selector ──────────────────────── */}
        <div className="mb-4 md:hidden">
          <div className="relative">
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as CalculatorId)}
              className="w-full appearance-none rounded-2xl border border-[color:var(--vt-border)] bg-[var(--vt-card)] px-4 py-3.5 pl-10 text-sm font-bold text-white outline-none transition-colors focus:border-[var(--vt-blue)]"
            >
              {CALCULATORS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <ActiveIcon
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--vt-blue)]"
            />
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--vt-muted)]"
            />
          </div>
        </div>

        {/* ── Main card ──────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[24px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] shadow-[0_28px_80px_rgba(10,13,46,0.35)]">
          <div className="flex flex-col md:flex-row">
            {/* ── Desktop sidebar nav ────────────────────────── */}
            <nav className="hidden shrink-0 border-r border-[color:var(--vt-border)] md:block md:w-48">
              <div className="flex flex-col gap-0.5 p-2">
                <div className="px-3 pb-3 pt-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--vt-muted)]">
                    Calculators
                  </div>
                </div>
                {CALCULATORS.map((c) => {
                  const Icon = c.icon;
                  const isActive = c.id === active;
                  return (
                    <Button
                      key={c.id}
                      type="button"
                      variant={isActive ? "accent" : "ghost"}
                      onClick={() => setActive(c.id)}
                      className={cn(
                        "h-auto w-full justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold",
                        !isActive && "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      <Icon size={15} className={isActive ? "text-white" : "text-[var(--vt-muted)]"} />
                      {c.label}
                    </Button>
                  );
                })}
              </div>
            </nav>

            {/* ── Calculator body ────────────────────────────── */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <ActiveCalculator id={active} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
