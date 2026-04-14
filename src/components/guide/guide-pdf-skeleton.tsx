/** Placeholder while the guide PDF viewer or document loads — avoids duplicate “Loading…” copy. */

function ShimmerBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.08] ${className}`} />;
}

export function GuidePdfSkeleton() {
  return (
    <div
      className="flex min-h-[min(70vh,36rem)] min-w-0 flex-1 flex-col items-center justify-start overflow-hidden bg-[#111] px-4 py-6 sm:px-6"
      role="status"
      aria-label="Loading guide"
    >
      <div className="w-full max-w-[min(100%,42rem)] rounded-sm border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        <ShimmerBlock className="mb-6 h-5 w-[72%]" />
        <div className="space-y-2.5">
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="h-3 w-full opacity-90" />
          <ShimmerBlock className="h-3 w-[94%] opacity-90" />
          <ShimmerBlock className="h-3 w-full opacity-90" />
          <ShimmerBlock className="h-3 w-[82%] opacity-90" />
        </div>
        <div className="mt-8 space-y-2.5 border-t border-white/[0.06] pt-6">
          <ShimmerBlock className="h-3 w-full opacity-70" />
          <ShimmerBlock className="h-3 w-full opacity-70" />
          <ShimmerBlock className="h-3 w-[90%] opacity-70" />
        </div>
      </div>
    </div>
  );
}
