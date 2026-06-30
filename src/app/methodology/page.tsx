import type { Metadata } from "next";

import { MethodologyView } from "@/components/methodology/methodology-view";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Methodology",
  description: `How ${getAppName()} sources records, rates entities, and keeps verdicts independent.`,
};

export default function MethodologyPage() {
  return <MethodologyView />;
}
