"use client";

import { Sparkles } from "lucide-react";

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
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <div className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70" />
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70 [animation-delay:150ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70 [animation-delay:300ms]" />
        </div>
        <div className="mt-3 text-xs font-medium text-[var(--vt-muted)]/60">
          Restoring session…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col items-center justify-center px-4 py-8 text-center">
      {/* Icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 rounded-full bg-[var(--vt-blue)]/20 blur-2xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[var(--vt-blue)]/20 to-transparent backdrop-blur-sm">
          <Sparkles className="size-7 text-[var(--vt-blue)]" strokeWidth={1.5} aria-hidden />
        </div>
      </div>

      {/* Text */}
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        What can I help with?
      </h1>
      <p className="mt-2 text-sm text-white/35">
        Ask about brokers, market briefings, lot sizing, chart analysis & more.
      </p>

      {/* Suggestion chips — w-full so the row uses viewport width; flex-wrap flows like before */}
      <div className="mt-8 flex w-full max-w-4xl flex-row flex-wrap justify-center gap-2 sm:gap-2.5">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="max-w-[min(100%,28rem)] shrink-0 cursor-pointer rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-left text-[13px] font-medium leading-snug text-white/55 transition-all duration-200 hover:-translate-y-px hover:border-[rgba(76,110,245,0.3)] hover:bg-[rgba(76,110,245,0.06)] hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
