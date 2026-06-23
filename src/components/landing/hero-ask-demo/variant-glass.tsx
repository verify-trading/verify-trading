"use client";

import { brandGradient } from "@/lib/brand";

import { AskCtaOverlay } from "./cta-overlay";
import {
  BrandMark,
  DemoComposer,
  DemoThread,
  type VariantViewProps,
} from "./shared";

/** Design 2 — Frameless glass app panel floating in a 3D tilt over an aurora glow. */
export function GlassView({
  state,
  onActivate,
  ctaOpen,
  onCloseCta,
}: VariantViewProps) {
  return (
    <div className="mx-auto w-full max-w-[360px] [perspective:1400px]">
      <div className="relative motion-safe:animate-[demo-float_8s_ease-in-out_infinite]">
        {/* Aurora glow behind the glass */}
        <div
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] opacity-60 blur-3xl motion-safe:animate-[demo-glow-pulse_6s_ease-in-out_infinite]"
          style={{ backgroundImage: brandGradient }}
          aria-hidden
        />

        {/* Tilted glass card — straightens on hover */}
        <div
          className="group relative h-[560px] overflow-hidden rounded-[28px] border border-white/15 bg-[rgba(13,17,56,0.55)] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-transform duration-700 ease-out [transform:rotateX(7deg)_rotateY(-12deg)] hover:[transform:rotateX(0deg)_rotateY(0deg)]"
        >
          {/* Top edge highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            aria-hidden
          />
          {/* Sweeping sheen */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent motion-safe:animate-[demo-sheen_7s_ease-in-out_infinite]"
            aria-hidden
          />

          <div className="relative z-20 flex h-full flex-col">
            {/* Window bar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                <span className="size-2.5 rounded-full bg-[#febc2e]" />
                <span className="size-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-1.5">
                <BrandMark size={20} />
                <span className="text-xs font-semibold text-white/70">
                  Ask · verify.trading
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-green)]">
                <span className="size-1.5 rounded-full bg-[var(--vt-green)]" />
                Live
              </span>
            </div>

            {/* Conversation */}
            <DemoThread state={state} onActivate={onActivate} />

            {/* Composer */}
            <div className="px-3 pb-4 pt-2">
              <DemoComposer
                onActivate={onActivate}
                className="border-white/15 bg-white/[0.06]"
              />
            </div>
          </div>

          <AskCtaOverlay open={ctaOpen} onClose={onCloseCta} />
        </div>
      </div>
    </div>
  );
}
