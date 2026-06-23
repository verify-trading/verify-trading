"use client";

import { getAppName } from "@/lib/site-config";

import { AskCtaOverlay } from "./cta-overlay";
import { DemoComposer, DemoThread, type VariantViewProps } from "./shared";

const APP_NAME = getAppName();

/** Design 4 — Calm editorial panel, frameless, with a composer that beckons. */
export function EditorialView({
  state,
  onActivate,
  ctaOpen,
  onCloseCta,
}: VariantViewProps) {
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="relative flex h-[560px] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[var(--vt-navy)] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)]">
        {/* Soft radial glow at the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(76,110,245,0.16),transparent_70%)]"
          aria-hidden
        />

        {/* Minimal header */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-2 items-center justify-center">
              <span className="size-2 rounded-full bg-[var(--vt-green)] shadow-[0_0_10px_var(--vt-green)]" />
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-white/80">
              Ask
            </span>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">
            {APP_NAME}
          </span>
        </div>

        {/* Conversation — roomier padding for the editorial feel */}
        <DemoThread
          state={state}
          onActivate={onActivate}
          className="px-5 py-5"
        />

        {/* Composer — the hero of this layout, with a beckoning glow */}
        <div className="relative z-10 px-5 pb-6 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Try it yourself
          </p>
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 rounded-[20px] bg-gradient-to-r from-[var(--vt-blue)]/30 via-[#8b5cf6]/25 to-[var(--vt-coral)]/30 opacity-70 blur-lg"
              aria-hidden
            />
            <DemoComposer
              onActivate={onActivate}
              className="relative rounded-[18px] border-white/15 bg-[rgba(10,13,46,0.95)] px-3 py-2.5"
              inputClassName="text-base"
              sendClassName="size-10"
            />
          </div>
        </div>

        <AskCtaOverlay open={ctaOpen} onClose={onCloseCta} />
      </div>
    </div>
  );
}
