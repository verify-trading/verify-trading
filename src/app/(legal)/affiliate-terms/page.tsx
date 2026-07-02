import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AcceptanceForm } from "./acceptance-form";

export const metadata: Metadata = {
  title: "Affiliate Partner Programme Terms",
  description:
    "Review the verify.trading Affiliate Partner Programme Terms before joining as a partner.",
};

const terms = [
  {
    title: "1. Definitions",
    paragraphs: [
      '"Company" means Verify Trading Ltd, the operator of the verify.trading platform.',
      '"Affiliate" or "Partner" means an individual or entity accepted into the Affiliate Partner Programme.',
      '"Referral Link" means the unique tracking URL assigned to the Affiliate after acceptance.',
    ],
  },
  {
    title: "2. Eligibility and Registration",
    paragraphs: [
      "To participate, an Affiliate must be aged 18 years or over, provide accurate registration details, and be authorised to enter into this agreement.",
      "The Company may approve, decline, suspend, or terminate participation at its discretion.",
    ],
  },
  {
    title: "3. Referral Tracking",
    paragraphs: [
      "Each accepted Affiliate will receive a unique Referral Link through Rewardful or another approved tracking provider.",
      "Self-referrals, duplicate accounts, fake accounts, and referrals generated through misleading conduct are not eligible for commission.",
    ],
  },
  {
    title: "4. Commission Structure",
    paragraphs: [
      "Eligible commissions are calculated according to the commission rate, payout schedule, and qualifying events shown in Rewardful or communicated by the Company.",
      "Commissions may be reversed or withheld for refunds, chargebacks, failed payments, fraud, abuse, or policy violations.",
    ],
  },
  {
    title: "5. Promotional Conduct",
    paragraphs: [
      "Affiliates must promote verify.trading honestly and must not make misleading income claims, trading performance claims, regulatory claims, or guarantees about financial outcomes.",
      "Paid search bidding on protected brand terms, impersonation, spam, cookie stuffing, forced clicks, and unauthorised use of Company assets are prohibited.",
    ],
  },
  {
    title: "6. Compliance",
    paragraphs: [
      "Affiliates are responsible for complying with applicable advertising, consumer protection, disclosure, privacy, tax, and financial promotion rules in their jurisdiction.",
      "Affiliate content should clearly disclose the commercial relationship where required by law, platform rules, or audience expectations.",
    ],
  },
  {
    title: "7. Termination",
    paragraphs: [
      "Either party may end affiliate participation at any time. The Company may withhold unpaid commissions connected to fraud, abuse, chargebacks, refunds, or breach of these terms.",
      "After termination, Affiliates must stop using Referral Links, Company marks, and promotional materials unless otherwise agreed in writing.",
    ],
  },
  {
    title: "8. Changes to Terms",
    paragraphs: [
      "The Company may update these terms, commission rates, payout rules, and programme requirements from time to time.",
      "Continued participation after changes take effect means the Affiliate accepts the updated terms.",
    ],
  },
] as const;

export default function AffiliateTermsPage() {
  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--vt-coral)]">
          Affiliate Partner Programme
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          One step before you start earning.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">
          Please review the Affiliate Partner Programme Terms below and confirm
          acceptance to continue to registration.
        </p>
        <ol className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-400">
          <li className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-[var(--vt-blue)] text-white">
              1
            </span>
            Review terms
          </li>
          <li className="text-slate-600">-&gt;</li>
          <li className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-white/10 text-slate-400">
              2
            </span>
            Accept
          </li>
          <li className="text-slate-600">-&gt;</li>
          <li className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-white/10 text-slate-400">
              3
            </span>
            Sign up on Rewardful
          </li>
        </ol>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong className="text-slate-200">Version 1.0</strong> | Effective
            15 June 2026
          </span>
          <span className="inline-flex items-center gap-2 text-[var(--vt-green)]">
            <span className="size-2 rounded-full bg-current" aria-hidden />
            Latest version
          </span>
        </div>

        <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
          <div className="flex flex-col gap-2 border-b border-white/10 bg-[var(--vt-blue)]/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <h2 className="text-sm font-bold text-white">
              verify.trading - Affiliate Partner Programme Terms
            </h2>
            <span className="font-mono text-xs text-slate-400">
              Review before accepting
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto bg-black/20 px-5 py-6 sm:px-7">
            <div className="space-y-7">
              {terms.map((term) => (
                <section key={term.title}>
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--vt-blue)]">
                    {term.title}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {term.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-sm leading-7 text-slate-300"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </article>

        <div className="mt-6">
          <AcceptanceForm />
        </div>

        <aside className="mt-6 flex gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--vt-green)]/30 bg-[var(--vt-green)]/10 text-[var(--vt-green)]">
            <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
          </div>
          <p>
            <strong className="text-slate-200">Partner note:</strong> keep a
            copy of these terms for your records. For questions, email{" "}
            <Link
              href="mailto:affiliates@verify.trading"
              className="text-[var(--vt-blue)] transition hover:text-white"
            >
              affiliates@verify.trading
            </Link>
            .
          </p>
        </aside>
      </section>
    </main>
  );
}
