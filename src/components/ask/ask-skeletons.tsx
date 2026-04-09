import type { HTMLAttributes } from "react";

import type { AskToolStatus } from "@/lib/ask/stream";

/** Claude Code–style burst / asterisk glyph (slow spin, no extra chrome). */
function AskWorkingGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <title>Working</title>
      <g transform="translate(12 12)">
        <rect x="-1" y="-8" width="2" height="16" rx="1" />
        <rect x="-1" y="-8" width="2" height="16" rx="1" transform="rotate(60)" />
        <rect x="-1" y="-8" width="2" height="16" rx="1" transform="rotate(-60)" />
      </g>
    </svg>
  );
}

/* ─── primitives (internal; use composed exports from this file in UI) ─── */

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.08] ${className}`}
      {...props}
    />
  );
}

function SkeletonLine({
  className = "",
  width = "w-full",
}: {
  className?: string;
  width?: string;
}) {
  return <Skeleton className={`h-3 ${width} ${className}`} />;
}

function SkeletonCircle({ className = "" }: { className?: string }) {
  return <Skeleton className={`rounded-full ${className}`} />;
}

/** Assistant-side row: avatar + lines only (no card chrome). */
function SkeletonAssistantMessageRow({
  className = "",
  bodyLines = 3,
}: {
  className?: string;
  bodyLines?: number;
}) {
  return (
    <div
      className={[
        "mx-1 flex items-start gap-3 rounded-xl px-4 py-3 sm:px-6",
        className,
      ].join(" ")}
    >
      <SkeletonCircle className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
        <SkeletonLine width="w-24" className="h-2 rounded opacity-70" />
        {Array.from({ length: bodyLines }, (_, i) => (
          <SkeletonLine
            key={i}
            width={
              i === bodyLines - 1 ? "w-[55%]" : i === 0 ? "w-full" : "w-[92%]"
            }
            className={[
              "max-w-md h-3 rounded",
              i === bodyLines - 1 ? "opacity-75" : "",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

/** User-side row: right-aligned lines + avatar (no bubble frame). */
function SkeletonUserMessageRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "mx-1 flex items-start gap-3 rounded-xl px-4 py-3 sm:px-6",
        className,
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
        <SkeletonLine width="w-16" className="h-2 rounded opacity-40" />
        <SkeletonLine width="w-52" className="max-w-[min(100%,22rem)] h-3 rounded opacity-90" />
        <SkeletonLine width="w-32" className="h-3 rounded opacity-70" />
      </div>
      <SkeletonCircle className="size-8 shrink-0" />
    </div>
  );
}

/* ─── Empty chat while history hydrates (same thread layout: assistant left, user right) ─── */

export function AskEmptyRestoringSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-3 py-6 sm:px-4 sm:py-8"
      role="status"
      aria-busy="true"
      data-testid="ask-empty-restoring"
    >
      <span className="sr-only">Restoring session…</span>
      <div className="ask-scrollbar mx-auto flex max-h-[min(70vh,28rem)] w-full max-w-4xl flex-col overflow-y-auto">
        <SkeletonAssistantMessageRow bodyLines={3} />
        <SkeletonUserMessageRow />
        <SkeletonAssistantMessageRow className="opacity-80" bodyLines={2} />
        <SkeletonUserMessageRow className="opacity-65" />
      </div>
    </div>
  );
}

/* ─── Thread: assistant streaming — avatar + line shimmer only (no card skeleton) ─── */

export function AskAssistantLoadingSkeleton({
  statuses = [],
}: {
  statuses?: AskToolStatus[];
}) {
  const headline = statuses[statuses.length - 1] ?? {
    id: "thinking",
    phase: "thinking" as const,
    label: "Thinking through your question",
    detail: "Deciding what matters and which live checks are worth running.",
  };

  return (
    <div
      className="mx-1 mb-2 flex items-center gap-3 rounded-xl px-4 py-3 sm:mb-3 sm:px-6"
      role="status"
      aria-busy="true"
      aria-label="Assistant is responding"
      data-testid="ask-assistant-loading"
    >
      <span className="sr-only">Analyzing…</span>
      <div className="flex size-8 shrink-0 items-center justify-center text-(--vt-blue)" aria-hidden>
        <AskWorkingGlyph className="size-[18px] animate-spin [animation-duration:2.4s]" />
      </div>
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-(--vt-blue)">
        {headline.label}
      </p>
    </div>
  );
}

export function AskThreadLoadOlderSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-xs flex-col items-center gap-2 px-4"
      role="status"
      aria-busy="true"
      aria-label="Loading older messages"
    >
      <span className="sr-only">Loading older messages</span>
      <SkeletonLine width="w-40" className="h-2" />
      <SkeletonLine width="w-32" className="h-2 opacity-70" />
    </div>
  );
}

export function AskThreadRestoringSkeleton() {
  return (
    <div role="status" aria-busy="true" data-testid="ask-thread-restoring">
      <span className="sr-only">Restoring session…</span>
      <SkeletonAssistantMessageRow bodyLines={3} />
      <SkeletonUserMessageRow />
      <SkeletonAssistantMessageRow className="opacity-80" bodyLines={2} />
      <SkeletonUserMessageRow className="opacity-65" />
    </div>
  );
}

/* ─── Sidebar ─── */

export function AskSessionListSkeleton() {
  return (
    <div
      className="space-y-3 px-2 py-2"
      role="status"
      aria-busy="true"
      aria-label="Loading sessions"
      data-testid="ask-sessions-loading"
    >
      <span className="sr-only">Loading sessions</span>
      {[0, 1, 2].map((key) => (
        <div key={key} className="space-y-2">
          <SkeletonLine width="w-16" className="h-2 opacity-60" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg opacity-80" />
        </div>
      ))}
    </div>
  );
}

export function AskSessionLoadMoreSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-2 px-2 py-3"
      role="status"
      aria-busy="true"
      aria-label="Loading more sessions"
    >
      <span className="sr-only">Loading more sessions</span>
      <SkeletonLine width="w-36" className="h-2" />
      <SkeletonLine width="w-28" className="h-2 opacity-60" />
    </div>
  );
}
