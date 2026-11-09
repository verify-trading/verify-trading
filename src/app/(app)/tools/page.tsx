import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { ToolsPage } from "@/components/tools/tools-page";
import { itemListSchema } from "@/lib/marketing/seo";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Free Trading Calculators",
  description: `Free trading tools from ${getAppName()} — lot size, risk/reward, pip value, margin, profit/loss, and compound-growth calculators, all in one place.`,
  alternates: { canonical: "/tools" },
};

// Kept in sync with CALCULATORS in tools-page.tsx, which is a client module and so can't be imported here.
const CALCULATOR_GUIDES = [
  { name: "Position size calculator", path: "/tools/position-size-calculator" },
  { name: "Risk/reward calculator", path: "/tools/risk-reward-calculator" },
  { name: "Pip value calculator", path: "/tools/pip-value-calculator" },
  { name: "Margin calculator", path: "/tools/margin-calculator" },
  { name: "Profit & loss calculator", path: "/tools/profit-loss-calculator" },
  { name: "Compound growth calculator", path: "/tools/compound-growth-calculator" },
];

export default function ToolsRoute() {
  return (
    <>
      <JsonLd data={itemListSchema({ name: "Free trading calculators", items: CALCULATOR_GUIDES })} />
      <ToolsPage />
    </>
  );
}

