"use client";

import dynamic from "next/dynamic";

import type { HeroAskVariant, HeroLiveBriefing } from "./types";

/**
 * Defers the animated phone demo (framer-motion) out of the initial hydration
 * path so the hero <h1> — the mobile LCP element — isn't blocked by its JS.
 * `ssr: false` renders the sized placeholder (matching the phone's
 * aspect-[392/800] frame, so there is no layout shift) and swaps in the real
 * demo after mount.
 */
const HeroAskDemo = dynamic(() => import("./index").then((m) => m.HeroAskDemo), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[392px]" aria-hidden>
      {/* Frosted-glass phone that reads as "materializing" — matches the live
          demo's frame + glow so the swap-in is a morph, not a pop. */}
      <div className="relative aspect-[392/800] overflow-hidden rounded-[56px] border border-white/[0.1] bg-white/[0.03] shadow-[0_50px_110px_-35px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.06] backdrop-blur-2xl motion-safe:animate-pulse">
        {/* brand glow — blue crown, coral base — echoing the real demo */}
        <div className="absolute inset-0 bg-[radial-gradient(130%_85%_at_50%_-12%,rgba(76,110,245,0.30),transparent_60%),radial-gradient(120%_70%_at_50%_112%,rgba(242,109,109,0.16),transparent_55%)]" />
        {/* dynamic-island hint so it reads as a device */}
        <div className="absolute left-1/2 top-3 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-white/[0.07]" />
      </div>
    </div>
  ),
});

export function HeroAskDemoLazy(props: {
  variant?: HeroAskVariant;
  liveBriefing?: HeroLiveBriefing | null;
}) {
  return <HeroAskDemo {...props} />;
}
