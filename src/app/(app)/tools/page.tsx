import type { Metadata } from "next";

import { ToolsPage } from "@/components/tools/tools-page";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Free Trading Calculators",
  description: `Free trading tools from ${getAppName()} — lot size, risk/reward, pip value, margin, profit/loss, and compound-growth calculators, all in one place.`,
  alternates: { canonical: "/tools" },
};

export default function ToolsRoute() {
  return <ToolsPage />;
}

