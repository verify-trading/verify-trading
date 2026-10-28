import type { Metadata } from "next";
import Link from "next/link";

import { CompoundGrowthCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/compound-growth-calculator";
const description =
  "Use our free trading compound growth calculator to project your balance, net profit and returns from monthly growth rates and regular deposits.";

export const metadata: Metadata = pageMetadata({ title: "Trading Compound Growth Calculator", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Compound Growth Calculator"
      description={description}
      h1={<>Compound growth calculator: <span className="text-[var(--vt-coral)]">where small returns end up.</span></>}
      lede="Set a starting balance, a monthly return and the number of months, and see the balance, net profit and total return at the end. Free and instant."
      tldr={[
        "Each month's gain compounds on the previous balance, so the end figure grows faster than a straight percentage of the starting balance.",
        "Example: 10,000 at 5% a month for 12 months grows to about 17,959, a net 7,959 (79.6%).",
        "Losses compound too: a 20% drawdown needs a 25% gain to recover, a 50% drawdown needs a 100% gain.",
        "This is a projection, not a forecast. Spreads, slippage, prop firm splits and fees shift the real number.",
      ]}
      calculator={<CompoundGrowthCalculator />}
      video={{ src: "/videos/compound-growth.mp4", poster: "/videos/compound-growth.jpg", title: "How to use the compound growth calculator", description: "A short walkthrough: starting balance, monthly return, months and deposits to see the projected balance.", uploadDate: "2026-10-21", duration: "PT27S" }}
      nextStep={
        <>
          For individual forex trade results, use our{" "}
          <Link href="/tools/profit-loss-calculator" className="text-[var(--vt-blue)] hover:underline">forex profit calculator</Link>{" "}
          with your entry price, exit price and lot size.
        </>
      }
      formulaTitle="Balance_n = (Balance_(n−1) + Deposit) × (1 + Rate)"
      formula="Final = Σ months of: (balance + deposit) × (1 + monthlyRate/100)"
      workedExample={[
        "Start 10,000, no deposits, 5% a month, 12 months.",
        "After month 1: 10,000 × 1.05 = 10,500.",
        "After month 12: 10,000 × 1.05^12 ≈ 17,959.",
        "Add 500 a month and the final balance climbs to about 25,929, with 7,929 of net profit over the 16,000 contributed.",
      ]}
      faqs={[...PAGE_FAQS.tools.compoundGrowth]}
    />
  );
}
