import type { Metadata } from "next";

import { ProfitLossCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/profit-loss-calculator";
const description =
  "Free forex profit/loss calculator: enter the pair, direction, entry, exit and lot size to see the P&L in the pair's quote currency and the move in pips.";

export const metadata: Metadata = pageMetadata({ title: "Profit / Loss Calculator (Forex P&L)", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Profit / Loss Calculator"
      description={description}
      h1={<>Profit / loss calculator: <span className="text-[var(--vt-coral)]">what the trade was worth.</span></>}
      lede="Pick the pair, your direction, the entry and the exit, and see the profit or loss in the pair's quote currency. Free and instant."
      tldr={[
        "P&L = move in the quote currency × units. For 1 lot EUR/USD long from 1.0850 to 1.0940, that's +0.0090 × 100,000 = +900 USD.",
        "Longs profit when price rises; shorts profit when price falls. The sign of the move flips with direction.",
        "The result is in the pair's quote currency (the second one). Convert at your broker's rate for your account currency.",
        "Free and instant, uses the entry and exit prices you type and ignores spread, swaps and commission.",
      ]}
      calculator={<ProfitLossCalculator />}
      video={{ src: "/videos/profit-loss.mp4", poster: "/videos/profit-loss.jpg", title: "How to use the profit / loss calculator", description: "A short walkthrough: pair, direction, entry, exit and lot size to see the P&L and pips moved.", uploadDate: "2026-10-21", duration: "PT25S" }}
      formulaTitle="P&L = (exit − entry) × units × direction, in the quote currency"
      formula="P&L = (Exit − Entry) × Lots × 100,000  (long)   |   P&L = (Entry − Exit) × Lots × 100,000  (short)"
      workedExample={[
        "Long 1 lot EUR/USD from 1.0850 to 1.0940. Units = 100,000.",
        "Move = 1.0940 − 1.0850 = 0.0090. P&L = 0.0090 × 100,000 = +900 USD.",
        "The same trade from the short side would show −900 USD.",
        "In pips: 0.0090 / 0.0001 = 90 pips. For a yen pair the pip size is 0.01 and the quote currency is yen, so convert to see dollars.",
      ]}
      faqs={[...PAGE_FAQS.tools.profitLoss]}
    />
  );
}
