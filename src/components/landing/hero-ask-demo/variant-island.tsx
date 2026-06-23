"use client";

import { brandGradient } from "@/lib/brand";
import { cn } from "@/lib/utils";

import { AskCtaOverlay } from "./cta-overlay";
import {
  Battery,
  BrandMark,
  DemoComposer,
  DemoThread,
  type VariantViewProps,
} from "./shared";

/** Design 3 — Energetic phone with a spinning gradient halo and a live Dynamic Island. */
export function IslandView({
  state,
  onActivate,
  ctaOpen,
  onCloseCta,
}: VariantViewProps) {
  return (
    <div className="relative mx-auto w-full max-w-[300px] motion-safe:animate-[demo-float_7.5s_ease-in-out_infinite]">
      {/* Spinning aurora halo */}
      <div
        className="pointer-events-none absolute -inset-5 -z-10 rounded-[60px] opacity-70 blur-2xl motion-safe:animate-[demo-ring-spin_9s_linear_infinite]"
        style={{ backgroundImage: brandGradient }}
        aria-hidden
      />

      {/* Gradient border */}
      <div
        className="rounded-[48px] p-[2px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]"
        style={{ backgroundImage: brandGradient }}
      >
        <div className="relative aspect-[300/620] rounded-[46px] bg-[#05060f] p-2">
          {/* Screen */}
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[38px] bg-[var(--vt-navy)]">
            <div
              className="pointer-events-none absolute -top-12 left-1/2 z-0 size-44 -translate-x-1/2 rounded-full bg-[#8b5cf6]/30 blur-3xl"
              aria-hidden
            />

            {/* Morphing Dynamic Island — expands into a live activity while thinking */}
            <div
              className={cn(
                "absolute left-1/2 top-2.5 z-30 flex -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-black transition-all duration-500 ease-out",
                state.thinking ? "h-7 w-[176px]" : "h-[26px] w-[90px]",
              )}
            >
              {state.thinking ? (
                <div className="flex items-center gap-2 px-3">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--vt-green)] opacity-70 motion-safe:animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-[var(--vt-green)]" />
                  </span>
                  <span className="whitespace-nowrap text-[10px] font-semibold text-white/85">
                    Verifying live data…
                  </span>
                </div>
              ) : null}
            </div>

            {/* Status bar */}
            <div className="relative z-20 flex items-center justify-between px-6 pb-1 pt-3 text-white">
              <span className="text-[13px] font-semibold tracking-tight">9:41</span>
              <Battery level={80} />
            </div>

            {/* App header */}
            <div className="relative z-20 flex items-center justify-between border-b border-white/[0.06] px-4 pb-2.5 pt-1.5">
              <div className="flex items-center gap-2">
                <BrandMark size={22} />
                <span className="text-sm font-bold tracking-tight text-white">
                  Ask
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(76,110,245,0.35)] bg-[rgba(76,110,245,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-blue)]">
                Real-time
              </span>
            </div>

            {/* Conversation */}
            <DemoThread state={state} onActivate={onActivate} />

            {/* Composer */}
            <div className="relative z-20 px-3 pb-2 pt-2">
              <DemoComposer onActivate={onActivate} />
              <div className="mx-auto mt-2.5 h-1 w-28 rounded-full bg-white/25" aria-hidden />
            </div>

            <AskCtaOverlay open={ctaOpen} onClose={onCloseCta} />
          </div>
        </div>
      </div>
    </div>
  );
}
