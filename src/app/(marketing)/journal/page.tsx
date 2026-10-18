import type { Metadata } from "next";
import { CalendarDays, Link2, Target } from "lucide-react";

import { ProPhone } from "@/components/marketing/mocks";
import { ProductPage } from "@/components/marketing/product-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/journal";
const description =
  "A trading journal app that logs P&L, mood and lessons, imports closed trades from your broker or a CSV, tracks prop firm challenges and writes a weekly insight. Part of Pro.";

export const metadata: Metadata = pageMetadata({ title: "Trading Journal App: Log, Import & Review", description, path });

export default function JournalPage() {
  return (
    <ProductPage
      path={path}
      name="Trading Journal"
      description={description}
      tier="Pro"
      eyebrow="Trading journal"
      title={<>A trading journal that <span className="text-[var(--vt-coral)]">fills itself in.</span></>}
      lede="Log P&L, mood and the lesson from each session, or connect your broker and let closed trades land in the diary. Track a prop firm challenge against its target, and read a weekly insight written from your own sessions."
      primary={{ label: "See Pro plans", href: "/pricing", event: "pricing" }}
      secondary={{ label: "Create a free account", href: "/signup", event: "signup" }}
      visual={<ProPhone screen="journal" />}
      featuresTitle="See the pattern before it costs you the account"
      featuresIntro="Designed to make keeping an honest trading diary effortless and repeatable:"
      features={[
        {
          icon: CalendarDays,
          theme: "blue",
          title: "Session calendar and diary",
          body: "Each day displays your P&L, emotional state, and lesson learned, giving you an instant monthly overview of your best and worst habits.",
        },
        {
          icon: Link2,
          theme: "green",
          title: "Broker sync and CSV import",
          body: "Connect your broker account to import closed trades automatically, or upload CSV files without tedious manual data entry.",
        },
        {
          icon: Target,
          theme: "amber",
          title: "Prop firm challenge mode",
          body: "Track cumulative profit against your evaluation target and monitor minimum and maximum trading days from your own entries.",
        },
      ]}
      howTitle="How the journal works"
      how={[
        {
          title: "Sync your trades",
          body: "Connect a supported broker account or import CSV platform exports so closed positions populate your calendar automatically.",
        },
        {
          title: "Record mood and takeaways",
          body: "Take 60 seconds at session close to log your emotional discipline, plan adherence, and the day's main lesson.",
        },
        {
          title: "Review insights and patterns",
          body: "Analyze monthly performance calendars and weekly summaries to pinpoint tilt triggers before they breach account rules.",
        },
      ]}
      free={[
        "Anything you have already logged stays readable",
        "Free calculators for lot size, risk to reward and more",
        "Entity checks on brokers and prop firms",
        "Ask, within your daily allowance",
      ]}
      planNote="Logging new sessions, broker connect, CSV import, the weekly insight and challenge setup are part of Pro."
      faqs={[...PAGE_FAQS.journal]}
      ctaTitle="Turn your sessions into a record"
      ctaBody="Journal comes with Pro, alongside Mind, the economic calendar and a higher Ask limit."
    />
  );
}
