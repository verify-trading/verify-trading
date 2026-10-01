import type { Metadata } from "next";
import { AudioLines, Brain, Radar } from "lucide-react";

import { ProPhone } from "@/components/marketing/mocks";
import { ProductPage } from "@/components/marketing/product-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";

const path = "/mind";
const description =
  "Trading psychology AI: a 30-question assessment scores five habits under pressure and draws your discipline radar, then a voice Companion helps you talk it through. Part of Pro.";

export const metadata: Metadata = pageMetadata({ title: "Trading Psychology App: Assessment & AI Coach", description, path });

export default function MindPage() {
  return (
    <ProductPage
      path={path}
      name="Mind"
      description={description}
      tier="Pro"
      eyebrow="Mind"
      title={<>Find out what your trading habits <span className="text-[var(--vt-coral)]">actually cost you.</span></>}
      lede="A 30-question assessment scores how you trade under pressure and draws your discipline radar. Then talk it through with a Companion in a live voice call, and reread any call as a transcript."
      primary={{ label: "See Pro plans", href: "/pricing", event: "pricing" }}
      secondary={{ label: "Create a free account", href: "/signup", event: "signup" }}
      visual={<ProPhone screen="mind" />}
      featuresTitle="A structured look at how you actually trade"
      featuresIntro="Identify behavioural blindspots and process breakdowns under pressure:"
      features={[
        {
          icon: Brain,
          theme: "purple",
          title: "Structured 30-question assessment",
          body: "Evaluates situational stress and five key trading habits under pressure: being wrong, fear, compulsion, awareness, and discipline.",
        },
        {
          icon: Radar,
          theme: "blue",
          title: "Five-habit discipline radar",
          body: "Maps your responses into an interactive radar chart, highlighting your weakest habit as the focal area to address first.",
        },
        {
          icon: AudioLines,
          theme: "coral",
          title: "AI voice Companion and transcripts",
          body: "Talk through challenging sessions, rule breaches, or next-day prep out loud, with every conversation preserved as a reviewable transcript.",
        },
      ]}
      howTitle="How Mind works"
      how={[
        {
          title: "Take the assessment",
          body: "Complete thirty multiple-choice questions reflecting your real trading habits rather than your ideal intentions.",
        },
        {
          title: "Examine your radar",
          body: "Review your scored habits to pinpoint the specific trigger behind revenge trades or premature exits.",
        },
        {
          title: "Debrief out loud",
          body: "Open a voice call with the Companion to unpack recent decisions and log tangible process adjustments.",
        },
      ]}
      free={[
        "Free account to see what Pro includes",
        "Free calculators and entity checks",
        "Ask, within your daily allowance",
      ]}
      planNote="The assessment, discipline radar, voice calls and saved transcripts are part of Pro."
      faqs={[...PAGE_FAQS.mind]}
      ctaTitle="Look at the trader behind the trades"
      ctaBody="Mind comes with Pro, alongside Journal, the economic calendar and a higher Ask limit."
      footnote="Mind is a coaching and self-awareness tool. It is not a medical or mental-health service."
    />
  );
}
