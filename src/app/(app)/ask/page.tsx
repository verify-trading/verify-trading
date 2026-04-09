import { Suspense } from "react";

import { AskWorkspace } from "@/components/ask/ask-workspace";
import { requireSession } from "@/lib/auth/session";

function AskSuspenseFallback() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden py-24"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="size-8 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-(--vt-blue)"
        aria-hidden
      />
    </div>
  );
}

export default function AskPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AskSuspenseFallback />}>
      <AskPageContent searchParams={searchParams} />
    </Suspense>
  );
}

function loginNextPathForAsk(
  resolvedSearchParams: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) qs.append(key, item);
      }
    } else {
      qs.set(key, value);
    }
  }
  const q = qs.toString();
  return q ? `/ask?${q}` : "/ask";
}

async function AskPageContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawSession = resolvedSearchParams.session;
  const initialSessionId = Array.isArray(rawSession) ? rawSession[0] : rawSession ?? null;

  await requireSession(loginNextPathForAsk(resolvedSearchParams));

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <AskWorkspace initialUrlSessionId={initialSessionId} />
    </div>
  );
}
