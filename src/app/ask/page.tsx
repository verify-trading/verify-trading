import { Suspense } from "react";

import { AskPageSkeleton } from "@/components/ask/ask-skeletons";
import { AskWorkspace } from "@/components/ask/ask-workspace";

export default function AskPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<AskPageSkeleton />}>
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
