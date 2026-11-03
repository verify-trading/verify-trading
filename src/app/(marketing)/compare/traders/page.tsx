import type { Metadata } from "next";

import { CompareView, type CompareSearchParams } from "@/components/marketing/compare-view";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/compare/traders";
const description =
  "Check trading educators and gurus against public records and court filings. Explore evidence-based verification statuses on verify.trading.";

export const metadata: Metadata = pageMetadata({ title: "Verify Trading Educators and Gurus", description, path });

export default async function Page({ searchParams }: { searchParams: Promise<CompareSearchParams> }) {
  return <CompareView type="guru" searchParams={await searchParams} />;
}
