import type { Metadata } from "next";

import { GuidePageClient } from "@/components/guide/guide-page-client";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Trading Guide",
  description: `A practical guide to verifying brokers and prop firms, checking broker regulation, and managing trading risk with ${getAppName()}.`,
  alternates: { canonical: "/guide" },
};

export default async function GuidePage() {
  return <GuidePageClient />;
}
