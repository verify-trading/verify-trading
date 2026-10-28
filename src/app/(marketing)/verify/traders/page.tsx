import type { Metadata } from "next";

import { CompareView, type CompareSearchParams } from "@/components/marketing/compare-view";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/verify/traders";
const description =
  "Verify trading educators and gurus against public records and court filings. Three-tier verdicts: Verified, Unverified or Caution — a Caution only when a cited regulator or court action backs it. No numeric score for a person.";

export const metadata: Metadata = pageMetadata({ title: "Verify Trading Educators and Gurus", description, path });

export default async function Page({ searchParams }: { searchParams: Promise<CompareSearchParams> }) {
  return <CompareView type="guru" searchParams={await searchParams} />;
}
