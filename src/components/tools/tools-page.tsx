"use client";

import { useState } from "react";

import { SiteNav } from "@/components/site/site-nav";
import {
  calculatePositionSize,
  calculateRiskAmount,
} from "@/lib/ask/calculators";
import { calculateCompoundBalance } from "@/lib/ask/projections";

function ToolCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-5 shadow-[0_18px_48px_rgba(10,13,46,0.28)]">
      <div className="text-lg font-black tracking-[-0.04em] text-white">{title}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--vt-muted)]">
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-full rounded-2xl border border-[color:var(--vt-border)] bg-[var(--vt-card-alt)] px-4 py-3 text-sm font-semibold text-white outline-none"
      />
    </label>
  );
}

export function ToolsPage() {
  const [account, setAccount] = useState(10_000);
  const [risk, setRisk] = useState(1);
  const [stopLoss, setStopLoss] = useState(20);
  const [growthMonths, setGrowthMonths] = useState(12);
  const [growthRate, setGrowthRate] = useState(5);

  const riskAmount = calculateRiskAmount(account, risk);
  const lotSize =
    stopLoss > 0
      ? calculatePositionSize({
          accountSize: account,
          riskPercent: risk,
          stopLossPips: stopLoss,
          pipValuePerLot: 10,
          accountCurrency: "GBP",
        }).lots
      : 0;
  const projectedBalance = calculateCompoundBalance(account, growthRate, growthMonths);

  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-2">
        <ToolCard title="Lot Size Calculator">
          <div className="space-y-4">
            <Input label="Account (£)" value={account} onChange={setAccount} />
            <Input label="Risk %" value={risk} onChange={setRisk} />
            <Input label="Stop Loss (pips)" value={stopLoss} onChange={setStopLoss} />
            <div className="rounded-3xl bg-[var(--vt-coral)] px-4 py-5 text-center">
              <div className="text-5xl font-black tracking-[-0.08em] text-white">
                {lotSize.toFixed(2)}
              </div>
              <div className="mt-1 text-sm font-semibold text-white/80">
                lots · risking £{riskAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </ToolCard>

        <ToolCard title="Compound Growth">
          <div className="space-y-4">
            <Input label="Starting Balance (£)" value={account} onChange={setAccount} />
            <Input label="Monthly % Gain" value={growthRate} onChange={setGrowthRate} />
            <Input label="Months" value={growthMonths} onChange={setGrowthMonths} />
            <div className="rounded-3xl border border-[rgba(76,110,245,0.28)] bg-[rgba(76,110,245,0.1)] px-4 py-5 text-center">
              <div className="text-4xl font-black tracking-[-0.08em] text-white">
                £{Math.round(projectedBalance).toLocaleString("en-GB")}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--vt-muted)]">
                projected balance after {growthMonths} months
              </div>
            </div>
          </div>
        </ToolCard>
      </main>
    </div>
  );
}
