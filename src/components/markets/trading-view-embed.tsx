"use client";

import { useEffect, useRef } from "react";

import { TRADINGVIEW_DEFAULT_CHART_SYMBOL } from "@/lib/markets/trading-view-symbols";

/** Advanced Real-Time Chart — TradingView’s own toolbar, symbol search, intervals, studies. */
const ADVANCED_CHART_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

export type TradingViewEmbedProps = {
  /** Initial symbol; users can switch to any symbol via TradingView’s built-in search. */
  symbol?: string;
  /** Bar interval (e.g. `1`, `5`, `60`, `D`, `W`). */
  interval?: string;
};

export function TradingViewEmbed({
  symbol = TRADINGVIEW_DEFAULT_CHART_SYMBOL,
  interval = "60",
}: TradingViewEmbedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const configKey = JSON.stringify({ symbol, interval });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const { symbol: sym, interval: intv } = JSON.parse(configKey) as {
      symbol: string;
      interval: string;
    };

    // https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
    const config = {
      autosize: true,
      symbol: sym,
      interval: intv,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      backgroundColor: "#0A0D2E",
      gridColor: "rgba(255, 255, 255, 0.06)",
      toolbar_bg: "#0A0D2E",
    };

    const script = document.createElement("script");
    script.src = ADVANCED_CHART_SCRIPT;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);

    root.appendChild(script);

    return () => {
      root.replaceChildren();
    };
  }, [configKey]);

  return (
    <div
      className={[
        "w-full overflow-hidden rounded-[14px]",
        "bg-[var(--vt-navy)]",
        "border border-[#303748]",
        "shadow-[0_24px_64px_rgba(0,0,0,0.42)]",
      ].join(" ")}
      style={{ height: "min(780px, calc(100dvh - 7rem))", minHeight: 440 }}
    >
      <div ref={rootRef} className="tradingview-widget-container h-full w-full">
        <div className="tradingview-widget-container__widget h-full w-full min-h-[440px]" />
      </div>
    </div>
  );
}
