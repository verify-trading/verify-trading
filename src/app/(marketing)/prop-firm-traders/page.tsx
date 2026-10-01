import type { Metadata } from "next";
import { Brain, CalendarClock, ShieldCheck } from "lucide-react";

import { AudiencePage } from "@/components/marketing/audience-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/prop-firm-traders";
const description =
  "Tools for prop firm challenge traders: verify a firm before you pay, see the news that breaks news rules, track your target and drawdown in a journal, and fix the habits that breach rules.";

export const metadata: Metadata = pageMetadata({ title: "Prop Firm Challenge Tools: Verify, Track & Pass", description, path });

export default function PropFirmTradersPage() {
  return (
    <AudiencePage
      path={path}
      name="Prop Firm Traders"
      description={description}
      eyebrow="For prop firm traders"
      title={<>Pass the challenge without <span className="text-[var(--vt-coral)]">breaking your own rules.</span></>}
      lede="A funded account is lost to a rule breach far more often than to a bad read of the market. verify.trading helps you pick the firm, plan around the news, and catch the habits that breach the rules."
      primary={{ label: "Check a prop firm", href: "/ask", event: "ask" }}
      secondary={{ label: "Compare prop firms", href: "/compare/prop-firms" }}
      helpTitle="Tools designed around prop firm evaluation rules"
      help={[
        {
          icon: ShieldCheck,
          theme: "green",
          title: "Verify the prop firm",
          body: "Check a firm's operating status, recorded payout disputes, and published rules before paying evaluation fees.",
          href: "/verify",
        },
        {
          icon: CalendarClock,
          theme: "amber",
          title: "Track restricted news",
          body: "Filter high-impact economic releases to avoid opening or holding positions during prohibited volatility windows.",
          href: "/economic-calendar",
        },
        {
          icon: Brain,
          theme: "purple",
          title: "Track drawdown and tilt",
          body: "Log challenge progress in the journal and pinpoint the emotional triggers that lead to daily loss breaches.",
          href: "/mind",
        },
      ]}
      workflowTitle="From choosing a firm to passing the phase"
      workflow={[
        { title: "Verify the firm", body: "Check its operating status and terms before paying: drawdown limits, news restrictions, consistency, and payout schedules." },
        { title: "Size to the daily limit", body: "Set trade risk so a normal consecutive losing streak cannot breach your maximum daily loss limit." },
        { title: "Plan around high-impact news", body: "Review the week's scheduled releases and decide when to be flat to avoid restricted event violations." },
        { title: "Track daily progress", body: "Log each session in challenge mode to monitor progress toward the target against remaining trading days." },
      ]}
      faqs={[...PAGE_FAQS.propFirmTraders]}
      ctaTitle="Know the firm and the rules first"
      ctaBody="Checking a prop firm is free. Pro adds the calendar, journal and Mind."
    />
  );
}
