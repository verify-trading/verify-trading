import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { getAppName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${getAppName()}.`,
  alternates: { canonical: "/privacy" },
};

// App Store 5.1.1(i)/5.1.2(i) requires this page to name what is collected, how, every use,
// and each third party it is shared with. The "AI features" section must stay in step with the
// consent copy in the mobile app (verify-trading-mobile src/features/consent/AiConsent.tsx):
// if a processor is added there, add it here in the same change.
export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      summary="This policy explains what verify.trading collects, how it is collected, what it is used for, and every third party it is shared with — including the AI services that process Ask, Journal, Challenge and Companion data. Last updated 31 August 2026."
      sections={[
        {
          title: "Who this covers",
          paragraphs: [
            "This policy applies to the verify.trading website and the verify.trading iOS app. It covers the account you create with us and everything you do while signed in.",
            "We are the controller of this data. The companies that process it on our behalf are listed under “Third parties we share data with”. We require each of them, by contract, to protect your data to a standard equivalent to the one described here, to use it only to provide their service to us, and not to use it for their own purposes.",
          ],
        },
        {
          title: "What we collect, and how",
          paragraphs: [
            "Account details, which you give us directly when you sign up or edit your profile: your email address, profile or display name, an authentication identifier, and — if you sign in with Apple or Google — the identifier that provider returns to us. We never receive your password for those providers.",
            "Your trading records, which you either type in or import: journal entries, notes, screenshots you attach, and — only if you connect a broker — the trade history read from your MT4 or MT5 account. Connecting a broker is optional and you can disconnect at any time.",
            "Your psychology data, which you generate by using Mind: assessment answers and scores, and the transcript of each Companion voice call.",
            "What you send to Ask and to members chat: the questions you type, any chart image you attach, and your chat messages.",
            "Billing details, if you subscribe. Card numbers are entered on Stripe’s systems and are never sent to or stored by us; we keep only your plan tier, subscription status, and Stripe customer identifier.",
            "Technical information generated automatically as you use the product: device or browser type, IP address, timestamps, and basic usage events needed for security, abuse prevention, billing, and diagnosing faults.",
          ],
        },
        {
          id: "ai",
          title: "AI features: what is sent, and to whom",
          paragraphs: [
            "The iOS app uses one versioned permission for its third-party AI features. After onboarding, it shows a standalone disclosure that identifies the data and recipients below and asks whether you allow AI data sharing. You may choose Not now and enter the app with AI sharing off. If you later try to use Ask, AI-assisted Challenge setup or the Mind Companion, the disclosure is shown again at that moment. Nothing described below is shared with an AI provider unless you explicitly choose Allow AI data sharing.",
            "Ask: your current question, recent messages in that Ask conversation and any chart image you attach go to our servers and then to Pikachu/Hueling AI, the third-party gateway at pikachu.hueling.cc. Pikachu/Hueling AI provides the OpenAI GPT/Codex-family model used to answer. Search terms derived from your question and public pages fetched to answer it are handled through the same gateway.",
            "Journal and Challenge: journal dates, moods, P&L, currency, notes, lessons and tags go through Pikachu/Hueling AI to an OpenAI model to produce weekly insights. When challenge coaching is enabled, your selected prop-firm name or URL, account type, account size, extracted rules and relevant P&L totals go through the same route to extract public firm rules or write a coaching line. Database identifiers, account email and storage timestamps are not included in the weekly-insight AI prompt. Saving and reading ordinary journal entries and viewing locally calculated statistics do not require AI sharing.",
            "Mind Companion: when you start a call, live microphone audio is streamed from your device directly to ElevenLabs for speech recognition and synthesised voice. ElevenLabs produces the running transcript and returns the final transcript to us so you can reread it. To generate Companion replies, the running transcript, your profile name, assessment answers and scores, recent journal entries, challenge context and relevant prior-call context go through Pikachu/Hueling AI to an Anthropic Claude model.",
            "We do not sell any of this data, and we do not use it to train our own models. We instruct our AI processors not to train on it and rely on their contractual commitments to that effect; we do not control their internal systems and cannot audit them directly.",
            "Your questions, transcripts, and assessments stay linked to your account so you can revisit them. Deleting your account, as described below, deletes them from our systems.",
          ],
        },
        {
          title: "How we use your data",
          paragraphs: [
            "To authenticate you and keep your account secure; to deliver the features you ask for, including generating answers, running Companion calls, and syncing your broker trades; to calculate your journal statistics and discipline scores; and to enforce free-plan limits such as the daily Ask and call allowances.",
            "To take payment, manage your subscription, and send you transactional email such as sign-in links, password resets, and billing notices.",
            "To investigate abuse, prevent fraud and automated sign-ups, diagnose faults, and meet our legal obligations.",
            "We do not sell your personal data, we do not share it with advertisers, and we do not use it for advertising profiling. If we ever add analytics or marketing tools, we will update this policy before turning them on.",
          ],
        },
        {
          title: "Third parties we share data with",
          paragraphs: [
            "Supabase — authentication and database hosting. Holds your account record, journal, assessments, transcripts, and chat messages at rest.",
            "Vercel — application hosting and content delivery. Processes requests and technical logs.",
            "Pikachu/Hueling AI (pikachu.hueling.cc) — the third-party AI gateway that provides access to OpenAI GPT/Codex-family models for Ask, Journal and Challenge, and Anthropic Claude-family models for the Mind Companion. It receives the feature-specific data listed in the AI section above and handles the web searches used by Ask.",
            "OpenAI — the underlying model provider for Ask, Journal and Challenge requests routed by Pikachu/Hueling AI. Receives the applicable Ask, journal or challenge prompt data listed above.",
            "Anthropic — the underlying Claude model provider for Mind Companion requests routed by Pikachu/Hueling AI. Receives the applicable transcript and coaching context listed above.",
            "ElevenLabs — speech recognition and synthesised voice for Companion calls. Receives your live microphone audio and running conversation during a call and produces the transcript.",
            "Stripe — subscription billing and card processing. Receives your payment details directly and your email address.",
            "Resend — transactional email delivery. Receives your email address and the message content.",
            "MetaApi — MT4 and MT5 broker connectivity, used only if you connect a broker. Receives the credentials you supply for that connection and returns your trade history.",
            "Cloudflare Turnstile — bot and abuse detection on sign-up forms. Receives technical signals from your browser.",
            "Market and reference data providers, including Twelve Data, Financial Modeling Prep, NewsAPI, Firecrawl, and the FCA Financial Services Register, receive the symbol or firm name being looked up. They do not receive your identity or your account data.",
          ],
        },
        {
          title: "Where your data is held",
          paragraphs: [
            "Our processors operate in the United States, the United Kingdom, and the European Union, so your data may be transferred outside your country of residence. Where a transfer leaves the UK or EEA, it relies on the UK International Data Transfer Agreement or the European Commission’s Standard Contractual Clauses.",
          ],
        },
        {
          title: "How long we keep it",
          paragraphs: [
            "Your account and everything in it — journal entries, assessments, call transcripts, Ask conversations, chat messages — are kept for as long as your account is open, because the product’s value is the history it builds.",
            "Deleting your account erases it immediately: your profile, journal, assessments, transcripts, Ask conversations, and chat messages are removed from our live database in the same request, and any active subscription is cancelled. Encrypted backups are rotated out within 30 days.",
            "Two things outlive the account, because the law requires it: billing records, kept for seven years for tax and accounting, and security logs, kept for up to 12 months.",
            "Data already passed to a processor is deleted according to that processor’s retention schedule under our agreement with them.",
          ],
        },
        {
          title: "Your rights and how to delete your data",
          paragraphs: [
            "You can delete your account and everything in it at any time, without contacting us: in the iOS app go to More, then Delete account; on the website, use the same option in your account settings. This is immediate and cannot be undone.",
            "You can also ask us to give you a copy of your data, correct it, restrict or object to how we use it, or withdraw consent you previously gave. In the iOS app, withdraw AI permission at any time under More → AI Features; new personal data is then blocked from AI providers. You may also withdraw consent by writing to us, or delete the account and its data using More → Delete account.",
            "Depending on where you live you may have these rights under the UK GDPR, the EU GDPR, the CCPA, or comparable law, including the right to complain to your data protection regulator. In the UK that is the Information Commissioner’s Office.",
            "To exercise any of these, email ai@verify.trading. We respond within one month.",
          ],
        },
        {
          title: "Children",
          paragraphs: [
            "verify.trading is not intended for anyone under 18, and we do not knowingly collect data from children. If you believe a child has created an account, email ai@verify.trading and we will delete it.",
          ],
        },
        {
          title: "Changes and contact",
          paragraphs: [
            "If we change how we use your data, or add a processor that receives it, we will update this page and change the date at the top. Where the change is material — a new AI processor, for example — we will ask for your consent again in the app before anything is sent to it.",
            "Questions about this policy, or about your data: ai@verify.trading.",
          ],
        },
      ]}
    />
  );
}
