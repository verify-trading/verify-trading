import type { HTMLAttributes } from "react";

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

/* ─── Ask /ask page Suspense fallback ─── */

export function AskPageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <header className="sticky top-0 z-50 border-b border-[color:var(--vt-border)] bg-[rgba(10,13,46,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-48 rounded-full sm:w-56" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </header>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col px-0 pb-0 pt-0">
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-80 shrink-0 flex-col border-r border-white/[0.04] py-3 lg:flex xl:w-96">
            <div className="flex justify-between px-3 pb-3">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <div className="mx-3 mb-3">
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div className="min-h-0 flex-1 space-y-2 px-2">
              <SkeletonLine width="w-12" className="h-2" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <SkeletonLine width="w-14" className="mt-4 h-2" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </aside>
          <div className="ask-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-2 py-4 sm:px-4">
            <div className="mx-auto flex w-full max-w-4xl flex-col">
              <SkeletonUserMessageRow />
              <SkeletonAssistantMessageRow bodyLines={3} />
              <SkeletonUserMessageRow className="opacity-85" />
              <SkeletonAssistantMessageRow className="opacity-70" bodyLines={2} />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Loading Ask…</span>
    </div>
  );
}

/* ─── Empty chat while history hydrates (same thread layout: assistant left, user right) ─── */

export function AskEmptyRestoringSkeleton() {
  return (
    <div
      className="ask-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-4 sm:px-4"
      role="status"
      aria-busy="true"
      data-testid="ask-empty-restoring"
    >
      <span className="sr-only">Restoring session…</span>
      <div className="mx-auto flex w-full max-w-4xl flex-col">
        <SkeletonAssistantMessageRow bodyLines={3} />
        <SkeletonUserMessageRow />
        <SkeletonAssistantMessageRow className="opacity-80" bodyLines={2} />
        <SkeletonUserMessageRow className="opacity-65" />
      </div>
    </div>
  );
}

/* ─── Thread: assistant streaming — avatar + line shimmer only (no card skeleton) ─── */

export function AskAssistantLoadingSkeleton() {
  return (
    <div
      className="mx-1 flex items-start gap-3 rounded-xl px-4 py-3 sm:px-6"
      role="status"
      aria-busy="true"
      aria-label="Assistant is responding"
      data-testid="ask-assistant-loading"
    >
      <span className="sr-only">Analyzing…</span>
      <SkeletonCircle className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
        <SkeletonLine width="w-28" className="h-2 rounded" />
        <SkeletonLine width="w-full" className="max-w-md h-3 rounded" />
        <SkeletonLine width="w-[92%]" className="max-w-md h-3 rounded opacity-90" />
        <SkeletonLine width="w-[55%]" className="max-w-md h-3 rounded opacity-80" />
      </div>
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
