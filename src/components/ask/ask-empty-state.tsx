"use client";

import { Sparkles } from "lucide-react";

import { brandGradient } from "@/lib/brand";

import { AskEmptyRestoringSkeleton } from "@/components/ask/ask-skeletons";

function LogoRingIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`relative size-14 sm:size-16 ${className}`}>
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-md"
        style={{ backgroundImage: brandGradient }}
        aria-hidden
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{ backgroundImage: brandGradient }}
      />
      <div className="absolute inset-[2px] flex items-center justify-center rounded-full border border-white/10 bg-[rgba(10,13,46,0.94)] sm:inset-[2.5px]">
        <Sparkles className="size-5 text-[var(--vt-blue)] sm:size-6" strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  );
}

function WelcomeBlock({ className = "" }: { className?: string }) {
  return (
    <div className={["text-center", className].filter(Boolean).join(" ")}>
      <div className="relative mb-4 sm:mb-5">
        <div className="absolute inset-0 scale-150 rounded-full bg-[var(--vt-blue)]/15 blur-xl" aria-hidden />
        <div className="relative mx-auto flex items-center justify-center rounded-2xl">
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
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

      {/* ─── Mobile: welcome centered in upper area; suggestions pinned above composer ─── */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-5 sm:max-w-xl sm:px-8">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4 sm:py-6">
            <WelcomeBlock />
          </div>

          <div className="w-full shrink-0 pb-2">
            <p className="mb-2 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
              Suggestions
            </p>
            <div
              className="flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain py-0.5 pl-0.5 pr-5 [scrollbar-width:none] touch-pan-x [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPromptClick(prompt)}
                  className="w-max shrink-0 snap-start rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-left text-[13px] font-medium leading-snug text-white/85 shadow-sm ring-1 ring-white/[0.03] transition active:scale-[0.99] sm:px-4 sm:py-3.5 sm:text-sm"
                >
                  <span className="line-clamp-3">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
