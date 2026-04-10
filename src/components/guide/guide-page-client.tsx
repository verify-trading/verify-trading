"use client";

import dynamic from "next/dynamic";

const GuidePdfViewer = dynamic(
  () => import("@/components/guide/guide-pdf-viewer").then((m) => m.GuidePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-black/20 text-sm text-white/60">
        Loading guide…
      </div>
    ),
  },
);

export function GuidePageClient() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-black/20">
      <GuidePdfViewer />
    </div>
  );
}
