import { Suspense } from "react";

import { AskWorkspace } from "@/components/ask/ask-workspace";

function AskPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--vt-navy)] text-white">
      <div className="flex items-center gap-2 text-sm font-medium text-white/45">
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70" />
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70 [animation-delay:150ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--vt-blue)]/70 [animation-delay:300ms]" />
        Loading Ask…
      </div>
    </div>
  );
}

export default function AskPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AskPageFallback />}>
      <AskPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AskPageContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawSession = resolvedSearchParams.session;
  const initialSessionId = Array.isArray(rawSession) ? rawSession[0] : rawSession ?? null;

  return <AskWorkspace initialUrlSessionId={initialSessionId} />;
}
