import type { Metadata } from "next";

import { CompareView, type CompareSearchParams } from "@/components/marketing/compare-view";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/compare/brokers";
const base = pageMetadata({
  title: "Compare Brokers: Verdicts and Regulators",
  description: "Search and compare brokers by name, verdict and regulator. Each record shows its basis and last update, computed from regulator records and not for sale.",
  path,
});

// Filtered and paged views canonicalise to the base page and stay out of the index.
export async function generateMetadata({ searchParams }: { searchParams: Promise<CompareSearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  return Object.keys(sp).length ? { ...base, robots: { index: false, follow: true } } : base;
}

export default async function CompareBrokersPage({ searchParams }: { searchParams: Promise<CompareSearchParams> }) {
  return <CompareView type="broker" searchParams={await searchParams} />;
}
