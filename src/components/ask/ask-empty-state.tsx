"use client";

import type { CSSProperties } from "react";

import { AskEmptyRestoringSkeleton } from "@/components/ask/ask-skeletons";
import { brandGradient } from "@/lib/brand";

const RING_MASK: CSSProperties = {
  mask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), black calc(100% - 3.5px))",
  WebkitMask:
    "radial-gradient(farthest-side, transparent calc(100% - 3.5px), black calc(100% - 3.5px))",
};

const ECHO_RING_COUNT = 4;
const ECHO_STAGGER_S = 0.26;

function LogoRingIcon({ className = "" }: { className?: string }) {
  const echoRingStyle: CSSProperties = {
    ...RING_MASK,
    backgroundImage: brandGradient,
    transformOrigin: "center",
    willChange: "transform, opacity",
    borderRadius: "50%",
  };

  return (
    <div className={`relative size-14 sm:size-16 ${className}`} aria-hidden>
      {/* Duplicate rings: same stroke as the logo, scale out + fade (ripple / “fire” energy) */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-visible">
        {Array.from({ length: ECHO_RING_COUNT }, (_, index) => (
          <div
            key={index}
            className="absolute inset-0 rounded-full motion-safe:animate-[ask-logo-ring-echo_1.05s_ease-out_infinite] motion-reduce:animate-none"
            style={{
              ...echoRingStyle,
              animationDelay: `${index * ECHO_STAGGER_S}s`,
            }}
          />
        ))}
      </div>

      {/* Soft bloom behind the sharp ring */}
      <div
        className="pointer-events-none absolute -inset-3 z-1 rounded-full blur-2xl motion-safe:animate-[ask-logo-ring-glow_3.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-50"
        style={{ backgroundImage: brandGradient }}
      />
      <div
        className="pointer-events-none absolute -inset-1 z-1 rounded-full opacity-70 blur-md"
        style={{ backgroundImage: brandGradient }}
      />

      {/* Main ring — static gradient (ripples carry the motion) */}
      <div className="absolute inset-0 z-2">
        <div
          className="size-full rounded-full"
          style={{
            ...RING_MASK,
            backgroundImage: brandGradient,
          }}
        />
      </div>

      <div className="absolute inset-[3.5px] z-3 rounded-full border border-white/10 bg-[rgba(10,13,46,0.94)] shadow-[inset_0_0_14px_rgba(0,0,0,0.45)]" />
    </div>
  );
}

function WelcomeBlock({ className = "" }: { className?: string }) {
  return (
    <div className={["text-center", className].filter(Boolean).join(" ")}>
      <div className="relative mb-4 px-2 pt-6 pb-2 sm:mb-5 sm:px-4 sm:pt-8">
        <div className="relative mx-auto flex items-center justify-center overflow-visible rounded-2xl">
          <LogoRingIcon />
        </div>
      </div>
      <h1 className="text-lg font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">
        What can I help with?
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-snug text-white/50 sm:mt-2.5 sm:text-base sm:leading-relaxed">
        Brokers, markets, sizing, charts, and projections. Ask in plain English.
      </p>
    </div>
  );
}

export function AskEmptyState({
  isLoadingHistory,
  prompts,
  onPromptClick,
}: {
  isLoadingHistory: boolean;
  prompts: string[];
  onPromptClick: (prompt: string) => void;
}) {
  if (isLoadingHistory) {
    return <AskEmptyRestoringSkeleton />;
  }

  const suggestionButtonClass =
    "group flex h-full min-h-[3.25rem] w-full items-start rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left text-sm font-medium leading-snug text-white/85 shadow-sm ring-1 ring-white/[0.03] transition hover:border-[rgba(76,110,245,0.35)] hover:bg-[rgba(76,110,245,0.08)] hover:text-white sm:text-base";

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden">
      {/* ─── Desktop / web: centered block; suggestions in a wrapping 2-col grid on wide panes ─── */}
      <div className="hidden min-h-0 flex-1 flex-col items-center justify-center px-8 py-10 lg:flex">
        <div className="w-full max-w-2xl">
          <WelcomeBlock className="mb-10" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prompts.map((prompt) => (
              <li key={prompt} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPromptClick(prompt)}
                  className={suggestionButtonClass}
                >
                  <span className="break-words">{prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Mobile: welcome only (no suggestion chips — desktop keeps the grid) ─── */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-4 lg:hidden sm:max-w-xl sm:px-8 sm:py-6">
        <div className="mx-auto w-full max-w-lg">
          <WelcomeBlock />
        </div>
      </div>
    </div>
  );
}
