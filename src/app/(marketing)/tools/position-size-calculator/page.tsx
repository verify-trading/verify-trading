import type { Metadata } from "next";

import { PositionSizeCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/position-size-calculator";
const description =
  "Free forex position size calculator: enter your account size, risk percentage, stop loss in pips and pair to get the lot size, risk amount and pip value. Works in USD, GBP and EUR.";

export const metadata: Metadata = pageMetadata({ title: "Position Size Calculator (Forex Lot Size)", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Position Size Calculator"
      description={description}
      h1={<>Position size calculator: <span className="text-[var(--vt-coral)]">how many lots to trade.</span></>}
      lede="Set the amount you are willing to lose, the distance to your stop, and get the lot size that risks exactly that. Free, instant and nothing is stored."
      calculator={<PositionSizeCalculator />}
      formulaTitle="Lot size = risk amount / (stop in pips x pip value per lot)"
      formula="Lots = (Account x Risk %) / (Stop pips x Pip value per lot)"
      workedExample={[
        "Account 10,000 USD, risk 1% = 100 USD at risk.",
        "Stop loss 20 pips on EUR/USD, pip value 10 USD per standard lot.",
        "Lots = 100 / (20 x 10) = 0.50 lots.",
        "Widen the stop to 50 pips and the size falls to 100 / (50 x 10) = 0.20 lots.",
      ]}
      faqs={[...PAGE_FAQS.tools.positionSize]}
    />
  );
}
