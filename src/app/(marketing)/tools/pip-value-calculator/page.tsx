import type { Metadata } from "next";

import { PipValueCalculator } from "@/components/marketing/tool-calculators";
import { ToolPage } from "@/components/marketing/tool-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/tools/pip-value-calculator";
const description =
  "Free forex pip value calculator: see what one pip is worth for your currency pair, lot size and account currency (USD, GBP or EUR), including JPY pairs.";

export const metadata: Metadata = pageMetadata({ title: "Pip Value Calculator (Forex)", description, path });

export default function Page() {
  return (
    <ToolPage
      path={path}
      name="Pip Value Calculator"
      description={description}
      h1={<>Pip value calculator: <span className="text-[var(--vt-coral)]">what one pip is worth.</span></>}
      lede="Choose a pair, a lot size and your account currency and see the money value of a single pip, so you can turn a stop in pips into a real loss. Free and instant."
      calculator={<PipValueCalculator />}
      formulaTitle="Pip value = units x pip size, converted to your account currency"
      formula="Pip value = (Lots x 100,000) x Pip size x Quote-to-account rate"
      workedExample={[
        "EUR/USD, 1 standard lot, USD account.",
        "Units = 100,000. Pip size = 0.0001. Quote currency is USD, so the rate is 1.",
        "Pip value = 100,000 x 0.0001 = 10 USD per pip.",
        "USD/JPY at 150, 1 lot: 100,000 x 0.01 = 1,000 JPY per pip, which is 1,000 / 150 = 6.67 USD.",
      ]}
      faqs={[...PAGE_FAQS.tools.pipValue]}
    />
  );
}
