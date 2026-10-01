import type { Metadata } from "next";
import { CalendarClock, Filter, ShieldAlert } from "lucide-react";

import { LiveCalendarPreview } from "@/components/marketing/live-previews";
import { ProPhone } from "@/components/marketing/mocks";
import { ProductPage } from "@/components/marketing/product-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { getHighImpactPreview } from "@/lib/marketing/live-data";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/economic-calendar";
const description =
  "A forex economic calendar with seven days of events across eight major economies, impact levels, forecast and previous figures, filters and an AI risk level. Plan around red-folder news.";

export const metadata: Metadata = pageMetadata({ title: "Economic Calendar for Forex Traders", description, path });

export const revalidate = 3600;

export default async function EconomicCalendarPage() {
  const preview = await getHighImpactPreview();

  return (
    <ProductPage
      path={path}
      name="Economic Calendar"
      description={description}
      tier="Pro"
      eyebrow="Economic calendar"
      title={<>See the news that can hit your trades <span className="text-[var(--vt-coral)]">before it lands.</span></>}
      lede="Seven days of scheduled events for the US, Germany, UK, Canada, Japan, Australia, New Zealand and China, with impact levels, forecasts and filters. Many prop firm rules restrict trading around high-impact news, and this is where you see it coming."
      primary={{ label: "See Pro plans", href: "/pricing", event: "pricing" }}
      secondary={{ label: "Create a free account", href: "/signup", event: "signup" }}
      visual={<ProPhone screen="calendar" />}
      featuresTitle="Scheduled releases filtered by market impact"
      featuresIntro="Plan ahead of high-volatility news and prop firm restricted windows:"
      features={[
        {
          icon: ShieldAlert,
          theme: "coral",
          title: "Clear impact levels",
          body: "Flag red-folder releases like central bank rate decisions, CPI prints, and NFP reports so high-volatility sessions stand out.",
        },
        {
          icon: Filter,
          theme: "blue",
          title: "Country and currency filters",
          body: "Filter the 7-day schedule to the specific currencies you trade so you only track what matters for your open positions.",
        },
        {
          icon: CalendarClock,
          theme: "amber",
          title: "Forecast, previous and actuals",
          body: "View consensus estimates alongside previous values before releases, and updated actuals once data is published.",
        },
      ]}
      howTitle="How the economic calendar works"
      how={[
        {
          title: "Events updated on a schedule",
          body: "High-impact releases across eight major economies are synchronized continuously so pages load instantly.",
        },
        {
          title: "Filter to your pairs",
          body: "Set filters for your trading pairs to monitor upcoming events without browsing through irrelevant releases.",
        },
        {
          title: "Plan around prop firm rules",
          body: "Pinpoint restricted news windows before opening trades to stay within your prop firm's volatility constraints.",
        },
      ]}
      extra={preview ? <LiveCalendarPreview events={preview.events} updatedAt={preview.updatedAt} /> : null}
      free={[
        "A read-only preview of the week's high-impact events on this page",
        "Ask about upcoming events, within your daily allowance",
        "Free calculators to size trades around news",
      ]}
      planNote="The full seven-day calendar with filters and an AI risk level is in Markets, part of Pro."
      faqs={[...PAGE_FAQS.calendar]}
      ctaTitle="Never be surprised by a red-folder event"
      ctaBody="The full calendar is part of Pro, with the daily brief and a higher Ask limit."
    />
  );
}
