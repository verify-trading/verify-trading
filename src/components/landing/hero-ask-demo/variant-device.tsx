"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";

import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

import { AskCtaOverlay } from "./cta-overlay";
import {
  Battery,
  BrandMark,
  DemoComposer,
  DemoThread,
  SignalBars,
  type VariantViewProps,
} from "./shared";

const APP_NAME = getAppName();

/** The Apple-style Dynamic Island that morphs into a live activity while thinking. */
function DynamicIsland({ thinking }: { thinking: boolean }) {
  return (
    <motion.div
      className="absolute left-1/2 top-2.5 z-30 flex h-[26px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-black"
      animate={{ width: thinking ? 178 : 92 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      <AnimatePresence>
        {thinking ? (
          <motion.div
            key="activity"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 whitespace-nowrap px-3"
          >
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--vt-green)] opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--vt-green)]" />
            </span>
            <span className="text-[10px] font-semibold text-white/85">
              Verifying live data…
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/** Design 1 (base) — polished iPhone frame with scroll parallax + a live thread. */
export function DeviceView({
  state,
  onActivate,
  ctaOpen,
  onCloseCta,
}: VariantViewProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Subtle scroll-linked parallax + 3D tilt as the phone passes through the viewport.
  const parallaxY = useTransform(scrollYProgress, [0, 1], [44, -44]);
  const tiltX = useTransform(scrollYProgress, [0, 0.5, 1], [7, 0, -7]);

  return (
    <div ref={ref} className="mx-auto w-full max-w-[392px] [perspective:1500px]">
      <motion.div style={reduced ? undefined : { y: parallaxY, rotateX: tiltX }}>
        {/* Reveal on first scroll into view */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 36, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Idle float */}
          <motion.div
            animate={reduced ? undefined : { y: [0, -9, 0] }}
            transition={
              reduced
                ? undefined
                : { duration: 6.5, repeat: Infinity, ease: "easeInOut" }
            }
          >
            {/* Device body */}
            <div className="relative aspect-[392/800] rounded-[56px] border border-white/[0.08] bg-[#05060f] p-[12px] shadow-[0_50px_110px_-35px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.02)] ring-1 ring-white/[0.04]">
              {/* Screen */}
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[44px] bg-[var(--vt-navy)]">
                {/* Ambient screen glow */}
                <div
                  className="pointer-events-none absolute -top-14 left-1/2 z-0 size-48 -translate-x-1/2 rounded-full bg-[var(--vt-blue)]/25 blur-3xl"
                  aria-hidden
                />

                <DynamicIsland thinking={state.thinking} />

                {/* Status bar */}
                <div className="relative z-20 flex items-center justify-between px-6 pb-1.5 pt-3.5 text-white">
                  <span className="text-[13px] font-semibold tracking-tight">
                    9:41
                  </span>
                  <div className="flex items-center gap-1.5">
                    <SignalBars />
                    <Battery />
                  </div>
                </div>

                {/* App header */}
                <div className="relative z-20 flex items-center justify-between border-b border-white/[0.06] px-4 pb-2.5 pt-1.5">
                  <div className="flex items-center gap-2">
                    <BrandMark size={22} />
                    <span className="text-sm font-bold tracking-tight text-white">
                      Ask
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--vt-green)]">
                    <span className="size-1.5 rounded-full bg-[var(--vt-green)]" />
                    Free
                  </span>
                </div>

                {/* Conversation */}
                <DemoThread state={state} onActivate={onActivate} />

                {/* Composer + home indicator */}
                <div className={cn("relative z-20 px-3 pb-2.5 pt-2")}>
                  <DemoComposer onActivate={onActivate} />
                  <p className="mt-2 text-center text-[10px] text-white/30">
                    {APP_NAME} · AI can make mistakes
                  </p>
                  <div
                    className="mx-auto mt-1.5 h-1 w-28 rounded-full bg-white/25"
                    aria-hidden
                  />
                </div>

                {/* In-screen subscription CTA */}
                <AskCtaOverlay open={ctaOpen} onClose={onCloseCta} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
