import type { Metadata } from "next";

import { CompareView, type CompareSearchParams } from "@/components/marketing/compare-view";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/compare/prop-firms";
const base = pageMetadata({
  title: "Compare Prop Firms: Verdicts and Status",
  description: "Search and compare prop firms by name, verdict and status. Each record shows its basis and last update, computed from public sources and not for sale.",
  path,
});

// Filtered and paged views canonicalise to the base page and stay out of the index.
export async function generateMetadata({ searchParams }: { searchParams: Promise<CompareSearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  return Object.keys(sp).length ? { ...base, robots: { index: false, follow: true } } : base;
}

export default async function ComparePropFirmsPage({ searchParams }: { searchParams: Promise<CompareSearchParams> }) {
  return <CompareView type="propfirm" searchParams={await searchParams} />;
}
