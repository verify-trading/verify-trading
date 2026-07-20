import type { Metadata } from "next";

import { MethodologyView } from "@/components/methodology/methodology-view";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "How We Verify Brokers & Prop Firms",
  description: `How ${getAppName()} verifies brokers and prop firms against FCA and other regulator records — and how independent scam-check verdicts are computed.`,
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return <MethodologyView />;
}
