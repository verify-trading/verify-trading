import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { VsView, vsSummary } from "@/components/marketing/vs-view";
import { resolveVsPage } from "@/lib/compare/vs-page";
import { pageMetadata } from "@/lib/marketing/seo";

// Rendered on first request, then cached and revalidated hourly (no build-time DB dependency).
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ pair: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await resolveVsPage("broker", (await params).pair);
  if (res.kind !== "ok") return { title: "Not found", robots: { index: false } };
  const meta = pageMetadata({
    title: `${res.a.name} vs ${res.b.name}: verdicts compared`,
    description: vsSummary(res.a, res.b),
    path: res.canonical,
  });
  return res.indexed ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Page({ params }: Props) {
  const res = await resolveVsPage("broker", (await params).pair);
  if (res.kind === "notFound") notFound();
  if (res.kind === "redirect") permanentRedirect(res.to);
  return <VsView a={res.a} b={res.b} />;
}
