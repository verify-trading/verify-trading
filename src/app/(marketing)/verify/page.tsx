import type { Metadata } from "next";
import { GraduationCap, Landmark, Scale } from "lucide-react";

import { VerifyCardMock } from "@/components/marketing/mocks";
import { ProductPage } from "@/components/marketing/product-page";
import { PAGE_FAQS } from "@/lib/marketing/faqs";
import { pageMetadata } from "@/lib/marketing/seo";
import { FREE_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

const path = "/verify";
const description =
  "Is my broker regulated? Check any broker, prop firm or educator against regulator and court records and get a plain verdict with the source shown, before you deposit or buy a challenge.";

export const metadata: Metadata = pageMetadata({ title: "Is My Broker Regulated? Verify Brokers & Prop Firms", description, path });

export default function VerifyPage() {
  return (
    <ProductPage
      path={path}
      name="Verify"
      description={description}
      tier="Free"
      eyebrow="Verify"
      title={<>Check who you are trading with <span className="text-[var(--vt-coral)]">before you deposit.</span></>}
      lede="Verify checks a name against regulator and court records and returns a plain verdict with the source shown. Entity checks are free, and a verdict is never behind a paywall."
      primary={{ label: "Check a name", href: "/ask", event: "ask" }}
      secondary={{ label: "Read the methodology", href: "/methodology" }}
      visual={<VerifyCardMock />}
      featuresTitle="One check for each kind of name"
      featuresIntro="Independent, sourced records for the entities you interact with:"
      features={[
        {
          icon: Landmark,
          theme: "blue",
          title: "Brokers",
          body: "Verify checks listed regulators, register status, FCA references, and warning-list entries, turning them into a clear trust band.",
        },
        {
          icon: Scale,
          theme: "amber",
          title: "Prop firms",
          body: "Operating status, published challenge rules, and scores for assessed firms. Unscored firms show as Not yet rated, and closed firms are clearly marked.",
        },
        {
          icon: GraduationCap,
          theme: "purple",
          title: "Educators",
          body: "Three clear labels: Verified, Unverified, or Caution. A Caution is only issued when backed by a documented, cited regulator or court action.",
        },
      ]}
      howTitle="How Verify works"
      how={[
        {
          title: "Ask by name",
          body: "Type a broker, prop firm or educator into Ask to check their regulatory status and operating history.",
        },
        {
          title: "Matched to official records",
          body: "Checks answer only from our verified registry, compiled from regulator registers, warning lists and court enforcement records.",
        },
        {
          title: "Read the verdict with sources",
          body: "You receive a clear band, regulator details and the official citation so you can inspect the primary register yourself.",
        },
      ]}
      free={[
        "Entity checks on brokers, prop firms and educators",
        `${FREE_DAILY_ASK_LIMIT} Ask chats a day`,
        "Public broker and prop firm records without an account",
        "Free position size, risk/reward, pip and margin calculators",
      ]}
      planNote="A verdict is never paywalled. Pro adds tools around the decision, not different verdicts."
      faqs={[...PAGE_FAQS.verify]}
      ctaTitle="Run your first check"
      ctaBody="It takes a few seconds, it is free, and it stays free."
    />
  );
}
