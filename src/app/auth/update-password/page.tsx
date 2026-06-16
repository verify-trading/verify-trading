import type { Metadata } from "next";
import { Suspense } from "react";

import {
  UpdatePasswordFallback,
  UpdatePasswordPageContent,
} from "@/app/auth/update-password/update-password-page-content";

export const metadata: Metadata = {
  title: "Reset password | verify.trading",
  description: "Choose a new password for your verify.trading account.",
};

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawNext = resolvedSearchParams.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext ?? null;

  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordPageContent nextParam={nextParam} />
    </Suspense>
  );
}
