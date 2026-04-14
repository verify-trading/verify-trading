"use client";

import dynamic from "next/dynamic";

import { GuidePdfSkeleton } from "@/components/guide/guide-pdf-skeleton";

const GuidePdfViewer = dynamic(
  () => import("@/components/guide/guide-pdf-viewer").then((m) => m.GuidePdfViewer),
  {
    ssr: false,
    loading: () => <GuidePdfSkeleton />,
  },
);

export function GuidePageClient() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black/20">
      <GuidePdfViewer />
    </div>
  );
}
