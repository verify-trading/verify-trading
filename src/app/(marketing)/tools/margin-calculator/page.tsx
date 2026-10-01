import type { Metadata } from "next";

import { MarginCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/margin-calculator";
const description =
  "Free forex margin calculator: enter the pair, lot size, price and leverage to see the margin a broker holds for the position, in USD, GBP or EUR. Understand margin calls.";

export const metadata: Metadata = pageMetadata({ title: "Forex Margin Calculator", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Margin Calculator"
      description={description}
      h1={<>Margin calculator: <span className="text-[var(--vt-coral)]">what a position ties up.</span></>}
      lede="Enter a pair, lot size, price and your leverage to see the margin your broker holds while the trade is open. Free and instant."
      calculator={<MarginCalculator />}
      formulaTitle="Margin = position value in account currency / leverage"
      formula="Margin = (Lots x 100,000 x Base-to-account rate) / Leverage"
      workedExample={[
        "Buy 1 standard lot EUR/USD at 1.0850, USD account, 30:1 leverage.",
        "Position value = 100,000 EUR x 1.0850 = 108,500 USD.",
        "Margin = 108,500 / 30 = 3,616.67 USD held while the trade is open.",
        "At 10:1 the same trade needs 10,850 USD, which is why lower leverage limits how big a position you can open.",
      ]}
      faqs={[...PAGE_FAQS.tools.margin]}
    />
  );
}
