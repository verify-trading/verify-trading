import type { Metadata } from "next";
import { Gauge, Newspaper, ShieldCheck } from "lucide-react";

import { LiveBriefPreview } from "@/components/marketing/live-previews";
import { ProPhone } from "@/components/marketing/mocks";
import { ProductPage } from "@/components/marketing/product-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { getLatestBriefPreview } from "@/lib/marketing/live-data";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/intelligence";
const description =
  "A daily pre-session market brief on gold, oil, the dollar and major FX pairs, with a bias, a key level and a one-line verdict for each. Context before you sit down to trade.";

export const metadata: Metadata = pageMetadata({ title: "Daily Market Brief for Forex & Gold Traders", description, path });

export const revalidate = 3600;

export default async function IntelligencePage() {
  const brief = await getLatestBriefPreview();

  return (
    <ProductPage
      path={path}
      name="Intelligence"
      description={description}
      tier="Pro"
      eyebrow="Intelligence"
      title={<>Know the tone of the session <span className="text-[var(--vt-coral)]">before it opens.</span></>}
      lede="A short daily brief on gold, oil, the dollar and major FX pairs: a bias, a level and a one-line verdict for each, and the tone to expect. It is market context, not trade advice."
      primary={{ label: "See Pro plans", href: "/pricing", event: "pricing" }}
      secondary={{ label: "Create a free account", href: "/signup", event: "signup" }}
      visual={<ProPhone screen="markets" />}
      featuresTitle="A morning read, not a noisy feed"
      featuresIntro="Clean pre-session market context delivered before London opens:"
      features={[
        {
          icon: Newspaper,
          theme: "amber",
          title: "Session tone and driver",
          body: "A short macro read of what is driving price action and what to watch for the session, written to be understood in under a minute.",
        },
        {
          icon: Gauge,
          theme: "blue",
          title: "Bias and levels for six assets",
          body: "Gold, oil, the dollar index, USD/JPY, EUR/USD and GBP/USD with a clear directional bias, a key level, and a concise verdict.",
        },
        {
          icon: ShieldCheck,
          theme: "green",
          title: "Live-locked prices",
          body: "Levels are programmatically synced to live price feeds so quoted figures never drift or show stale numbers.",
        },
      ]}
      howTitle="How the daily brief works"
      how={[
        {
          title: "Live quotes collected",
          body: "Real-time pricing feeds and global market headlines are compiled each morning ahead of major trading sessions.",
        },
        {
          title: "Constrained AI synthesis",
          body: "The model drafts the brief strictly from verified data and headlines, preventing fabricated claims or unsupported figures.",
        },
        {
          title: "Prices locked and published",
          body: "Quoted numbers are locked to live market ticks and published to the Markets dashboard in under a minute's reading time.",
        },
      ]}
      extra={brief ? <LiveBriefPreview brief={brief} /> : null}
      free={[
        "Ask for market context on request, within your daily allowance",
        "A preview of the latest brief on this page",
        "Free calculators and entity checks",
      ]}
      planNote="The full morning brief and live market radar sit in the Markets tab, part of Pro."
      faqs={[...PAGE_FAQS.intelligence]}
      ctaTitle="Start the day with context"
      ctaBody="Pro includes the daily brief, market radar, the economic calendar and a higher Ask limit."
      footnote="The brief is AI-generated market context and not a recommendation to trade."
    />
  );
}
