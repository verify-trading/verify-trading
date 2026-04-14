"use client";

import { useId } from "react";

import { buildSparklinePath } from "@/lib/markets/markets-page-data";

export function MarketSparkline({
  values,
  tone,
  compact = false,
}: {
  values: number[];
  tone: "up" | "down";
  compact?: boolean;
}) {
  const gradientId = useId();
  const glowId = useId();
  const width = compact ? 280 : 480;
  const height = compact ? 96 : 168;
  const path = buildSparklinePath(values, width, height);
  const stroke = tone === "up" ? "var(--vt-green)" : "var(--vt-coral)";
  const fill =
    tone === "up"
      ? "rgba(34, 197, 94, 0.16)"
      : "rgba(242, 109, 109, 0.16)";
  const glowColor =
    tone === "up"
      ? "rgba(34, 197, 94, 0.4)"
      : "rgba(242, 109, 109, 0.4)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={
        compact
          ? "!block !h-[5.5rem] !min-h-[5.5rem] !w-full !max-w-none sm:!h-24 sm:!min-h-24"
          : "!block !h-44 !min-h-[11rem] !w-full !max-w-none sm:!h-52 sm:!min-h-[13rem]"
      }
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation={compact ? 3 : 4} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={`${path} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#${gradientId})`}
      />
      <path d={path} fill="none" stroke={glowColor} strokeWidth={compact ? 6 : 8} strokeLinecap="round" opacity={0.3} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={compact ? 2.75 : 3.5} strokeLinecap="round" />
    </svg>
  );
}
