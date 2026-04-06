"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectionCard } from "@/lib/ask/contracts";

const tooltipBox =
  "rounded-[10px] border border-[rgba(76,110,245,0.28)] bg-[rgba(15,19,64,0.96)] px-2.5 py-1.5 text-xs text-white shadow-lg";

function ProjectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { month: number; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className={tooltipBox}>
      <div className="font-semibold text-white/80">Month {row.month}</div>
      <div className="tabular-nums text-[var(--vt-blue)]">
        £{row.value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}

function MarketTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { step: number; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const v = row.value;
  const formatted =
    Math.abs(v) >= 1000 && Math.abs(v) < 1e6
      ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 })
      : v >= 0.01 && v < 1000
        ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 })
        : v.toFixed(Math.abs(v) < 1 ? 5 : 2);
  return (
    <div className={tooltipBox}>
      <div className="tabular-nums text-white/90">{formatted}</div>
    </div>
  );
}

/** Interactive equity curve (projection cards) — hover for balance by month. */
export function InteractiveProjectionCurve({
  card,
  markers,
}: {
  card: ProjectionCard;
  markers?: number[];
}) {
  const gid = useId().replace(/:/g, "");
  const fillId = `projection-fill-${gid}`;

  const data = useMemo(
    () =>
      card.dataPoints.map((value, i) => ({
        month: i + 1,
        value,
      })),
    [card.dataPoints],
  );

  const min = Math.min(...card.dataPoints);
  const max = Math.max(...card.dataPoints);
  const pad = Math.max((max - min) * 0.08, 1);

  if (data.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[var(--vt-card-alt)] px-3 py-6 text-center text-xs text-white/40">
        Not enough points to plot.
      </div>
    );
  }

  return (
    <div data-testid="projection-curve" className="h-[min(200px,42vw)] w-full min-h-[120px] sm:h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--vt-blue)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--vt-blue)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => {
              if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}`;
              if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(0)}k`;
              return `£${Math.round(v)}`;
            }}
          />
          <Tooltip content={<ProjectionTooltip />} cursor={{ stroke: "rgba(76,110,245,0.45)" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--vt-blue)"
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            fillOpacity={1}
            isAnimationActive={false}
          />
          {markers?.map((markerIndex) => {
            const row = data[markerIndex];
            if (!row) return null;
            return (
              <ReferenceDot
                key={markerIndex}
                x={row.month}
                y={row.value}
                r={5}
                fill="var(--vt-coral)"
                stroke="var(--vt-navy)"
                strokeWidth={1.5}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Interactive market sparkline (briefing cards) — hover for level. */
export function InteractiveMarketMiniChart({ points, up }: { points: number[]; up: boolean }) {
  const data = useMemo(
    () =>
      points.map((value, i) => ({
        step: i + 1,
        value,
      })),
    [points],
  );

  const stroke = up ? "var(--vt-green)" : "var(--vt-coral)";

  if (points.length < 2) {
    return (
      <div
        data-testid="market-mini-chart"
        className="rounded-2xl bg-[var(--vt-card-alt)] px-2 py-6 text-center text-xs text-white/40"
      >
        —
      </div>
    );
  }

  return (
    <div
      data-testid="market-mini-chart"
      className="h-[92px] w-full rounded-2xl bg-[var(--vt-card-alt)] px-1 py-1 sm:h-[100px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 2 }}>
          <XAxis dataKey="step" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip content={<MarketTooltip />} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.4}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
