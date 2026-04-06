"use client";

import { TradingViewEmbed } from "@/components/markets/trading-view-embed";
import { SiteNav } from "@/components/site/site-nav";

export function MarketsPage() {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
        <h1 className="sr-only">Markets</h1>
        <TradingViewEmbed />
      </main>
    </div>
  );
}
