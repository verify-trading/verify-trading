"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { History, MessageSquarePlus } from "lucide-react";

import { getAppName } from "@/lib/site-config";

import { DemoSheet, type DemoSheetTarget } from "./demo-sheet";
import { DemoTabBar, HeaderButton, ProHeader, ProScreenBody, ScreenHeader } from "./pro-screens";
import { Battery, DemoComposer, DemoSuggestionStrip, DemoThread, SignalBars } from "./shared";
import type { DemoScreen } from "./types";
import type { DemoState } from "./use-ask-demo-sequence";

export type DeviceViewProps = {
  screen: DemoScreen;
  /** Ask conversation state (only shown on the Ask screen). */
  state: DemoState;
  /** Any tap on the demo content: opens the sheet for whatever is showing. */
  onActivate: () => void;
  onSelectScreen: (screen: DemoScreen) => void;
  /** Pauses the cycle while a finger/pointer is down. */
  onHold: (holding: boolean) => void;
  sheetTarget: DemoSheetTarget | null;
  onCloseSheet: () => void;
};

const APP_NAME = getAppName();

/** The Apple-style Dynamic Island that morphs into a live activity while thinking. */
function DynamicIsland({ thinking }: { thinking: boolean }) {
  return (
    <motion.div
      className="absolute left-1/2 top-2.5 z-30 flex h-[26px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-black"
      animate={{ width: thinking ? 152 : 88 }}
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
            className="flex items-center gap-1.5 whitespace-nowrap px-2.5"
          >
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--vt-green)] opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--vt-green)]" />
            </span>
            <span className="text-[9.5px] font-semibold text-white/85">
              Verifying live data…
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/** Polished iPhone frame: the Ask conversation or a Pro screen, a tab bar, and the CTA sheet. */
export function DeviceView({
  screen,
  state,
  onActivate,
  onSelectScreen,
  onHold,
  sheetTarget,
  onCloseSheet,
}: DeviceViewProps) {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-[340px] sm:max-w-[392px]">
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
            <div className="relative aspect-[392/800] rounded-[48px] border border-white/[0.08] bg-[#05060f] p-[10px] shadow-[0_50px_110px_-35px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.02)] ring-1 ring-white/[0.04] sm:rounded-[56px] sm:p-[12px]">
              {/* Screen */}
              <div
                className="relative flex h-full w-full flex-col overflow-hidden rounded-[38px] bg-[var(--vt-navy)] sm:rounded-[44px]"
                onPointerDown={() => onHold(true)}
                onPointerUp={() => onHold(false)}
                onPointerLeave={() => onHold(false)}
                onPointerCancel={() => onHold(false)}
              >
                {/* Ambient screen glow */}
                <div
                  className="pointer-events-none absolute -top-14 left-1/2 z-0 size-48 -translate-x-1/2 rounded-full bg-[var(--vt-blue)]/25 blur-3xl"
                  aria-hidden
                />

                <DynamicIsland thinking={screen === "ask" && state.thinking} />

                {/* Status bar */}
                <div className="relative z-20 flex items-center justify-between px-4 pb-1.5 pt-3.5 text-white sm:px-6">
                  <span className="text-[13px] font-semibold tracking-tight">
                    9:41
                  </span>
                  <div className="flex items-center gap-1.5">
                    <SignalBars />
                    <Battery />
                  </div>
                </div>

                {screen === "ask" ? (
                  <>
                    {/* App header: same as the app's Ask tab (history + new chat buttons) */}
                    <ScreenHeader
                      title="Ask"
                      subtitle="3 saved conversations"
                      right={
                        <>
                          <HeaderButton>
                            <History className="size-[17px]" strokeWidth={2} aria-hidden />
                          </HeaderButton>
                          <HeaderButton>
                            <MessageSquarePlus className="size-[17px]" strokeWidth={2} aria-hidden />
                          </HeaderButton>
                        </>
                      }
                    />

                    {/* Conversation: a tap anywhere opens the free sheet, like the Pro screens */}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      <DemoThread state={state} onActivate={onActivate} />
                      <button
                        type="button"
                        aria-label="Try Ask free"
                        onClick={onActivate}
                        className="absolute inset-0 z-20 cursor-pointer"
                      />
                    </div>

                    {/* Composer */}
                    <div className="relative z-20 px-3 pb-2 pt-2">
                      <DemoSuggestionStrip state={state} onActivate={onActivate} />
                      <DemoComposer onActivate={onActivate} />
                      <p className="mt-1.5 text-center text-[10px] text-white/30">
                        {APP_NAME} · AI can make mistakes
                      </p>
                    </div>
                  </>
                ) : (
                  <motion.div
                    // The calendar is the Markets screen on another sub-tab, so it keeps this key.
                    key={screen === "calendar" ? "markets" : screen}
                    className="relative flex min-h-0 flex-1 flex-col"
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <ProHeader screen={screen} />
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      <ProScreenBody screen={screen} onSelectScreen={onSelectScreen} />
                      {/* Fades the mock into the tab bar, like a scrolled app screen. */}
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[var(--vt-navy)] to-transparent"
                        aria-hidden
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="See what Pro includes"
                      onClick={onActivate}
                      className="absolute inset-0 z-20 cursor-pointer"
                    />
                  </motion.div>
                )}

                <DemoTabBar screen={screen} onSelect={onSelectScreen} />
                <div className="relative z-20 pb-2 pt-1" aria-hidden>
                  <div className="mx-auto h-1 w-28 rounded-full bg-white/25" />
                </div>

                {/* In-screen CTA sheet */}
                <DemoSheet target={sheetTarget} onClose={onCloseSheet} />
              </div>
            </div>
          </motion.div>
    </div>
  );
}
