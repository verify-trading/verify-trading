import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Programme — Earn 30% Recurring | verify.trading",
  description:
    "Turn referrals into recurring revenue. Earn 30% commission every month, for every Pro member you refer to verify.trading. No caps, no expiry.",
};

const APPLY_URL = "https://verify-trading.getrewardful.com/signup";
const SUPPORT_EMAIL = "affiliates@verify.trading";

export default function AffiliatesPage() {
  return (
    <main className="bg-[#0a0e1f] text-slate-200">
      {/* SECTION 1 — HERO */}
      <section className="relative overflow-hidden px-6 pb-32 pt-24 text-center sm:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_1000px_500px_at_50%_0%,rgba(139,92,246,0.15),rgba(236,72,153,0.08)_30%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
            Affiliate Programme
          </p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn referrals into{" "}
            <span className="block bg-gradient-to-r from-pink-500 via-violet-400 to-violet-500 bg-clip-text text-transparent">
              recurring revenue.
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Earn 30% commission every month, for every trader you refer to
            verify.trading. No caps. No expiry. Real recurring income, paid
            monthly.
          </p>
          <div className="mt-10 flex justify-center">
            
              href={APPLY_URL}
              className="inline-flex h-[50px] items-center gap-2.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-8 text-sm font-semibold text-white shadow-[0_0_50px_rgba(139,92,246,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(139,92,246,0.5)]"
            >
              Partner with verify.trading
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/20 text-xs">
                →
              </span>
            </a>
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            {[
              "30% recurring commission",
              "Monthly payouts",
              "60-day cookie window",
            ].map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-sm text-slate-400"
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-400">
                  ✓
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2 — STATS CARD (overlapping) */}
      <section className="relative z-10 -mt-20 px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 rounded-3xl bg-white p-12 shadow-[0_20px_80px_rgba(0,0,0,0.4)] sm:grid-cols-3 sm:p-12">
          <div className="text-center sm:px-6">
            <p className="text-sm font-medium text-slate-500">Earn</p>
            <p className="mt-3 bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-5xl font-bold leading-none tracking-tight text-transparent sm:text-6xl">
              30%
            </p>
            <p className="mt-3 text-base font-semibold text-slate-900 sm:text-lg">
              recurring commission
            </p>
          </div>
          <div className="text-center sm:border-x sm:border-slate-200 sm:px-6">
            <p className="text-sm font-medium text-slate-500">For</p>
            <p className="mt-3 bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-5xl font-bold leading-none tracking-tight text-transparent sm:text-6xl">
              Every
            </p>
            <p className="mt-3 text-base font-semibold text-slate-900 sm:text-lg">
              month they stay
            </p>
          </div>
          <div className="text-center sm:px-6">
            <p className="text-sm font-medium text-slate-500">Payout in</p>
            <p className="mt-3 bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-5xl font-bold leading-none tracking-tight text-transparent sm:text-6xl">
              30 days
            </p>
            <p className="mt-3 text-base font-semibold text-slate-900 sm:text-lg">
              every month
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — WHY PARTNER (6 cards) */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
              Why partner
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Why partner with{" "}
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                verify.trading?
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-400">
              Six reasons creators, educators, and community admins choose us.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "💰",
                title: "Recurring commission",
                body: "Earn 30% of every Pro subscription, every single month they stay. No caps, no expiry — pure recurring income.",
                gradientText: true,
              },
              {
                icon: "🎯",
                title: "Real product, real demand",
                body: "verify.trading helps traders verify brokers and signals — a genuine pain point that converts naturally.",
              },
              {
                icon: "📅",
                title: "Monthly payouts",
                body: "Get paid via PayPal or Wise once your balance hits £20. Predictable. Automated. No chasing invoices.",
              },
              {
                icon: "📊",
                title: "Real-time dashboard",
                body: "Track clicks, signups, and earnings in real time. Powered by Rewardful + Stripe — accurate down to the second.",
              },
              {
                icon: "⏱️",
                title: "60-day cookie window",
                body: "Get credit for signups up to 60 days after the click. Plenty of time to convert your traffic.",
              },
              {
                icon: "🚀",
                title: "Built for creators",
                body: "Twitter/X, Discord, trading educators, course creators. Built around how real audiences actually convert.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group relative overflow-hidden rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-950/40 to-slate-900/30 p-8 transition hover:-translate-y-1 hover:border-violet-400/40"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.15),transparent_70%)]" />
                <div className="relative">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/25 bg-gradient-to-br from-pink-500/15 to-violet-500/15 text-2xl">
                    {card.icon}
                  </div>
                  <h3
                    className={
                      card.gradientText
                        ? "mb-3 bg-gradient-to-r from-white to-pink-200 bg-clip-text text-xl font-semibold leading-tight text-transparent"
                        : "mb-3 text-xl font-semibold leading-tight text-white"
                    }
                  >
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {card.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — EARNINGS TABLE */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_50%_50%,rgba(139,92,246,0.08),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
              Earning potential
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Your{" "}
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                earning potential.
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-400">
              30% recurring commission on every Pro subscription. Based on
              £20/month plan.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-slate-900/40 shadow-[0_20px_60px_rgba(139,92,246,0.1)]">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-pink-500/[0.08] to-violet-500/[0.08]">
                <tr>
                  <th className="border-b border-violet-500/20 px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Referrals
                  </th>
                  <th className="border-b border-violet-500/20 px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Monthly earnings
                  </th>
                  <th className="border-b border-violet-500/20 px-7 py-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Annual earnings
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1", "referral", "£6 / month", "£72 / year"],
                  ["5", "referrals", "£30 / month", "£360 / year"],
                  ["10", "referrals", "£60 / month", "£720 / year"],
                  ["25", "referrals", "£150 / month", "£1,800 / year"],
                  ["50", "referrals", "£300 / month", "£3,600 / year"],
                ].map(([num, label, monthly, annual], idx, arr) => (
                  <tr
                    key={num}
                    className={`transition hover:bg-violet-500/[0.05] ${
                      idx < arr.length - 1
                        ? "border-b border-violet-500/[0.08]"
                        : ""
                    }`}
                  >
                    <td className="px-7 py-6 text-base font-medium text-slate-200">
                      <span className="mr-1.5 text-lg font-semibold text-white">
                        {num}
                      </span>
                      {label}
                    </td>
                    <td className="bg-gradient-to-r from-pink-500 to-violet-400 bg-clip-text px-7 py-6 text-base font-semibold text-transparent">
                      {monthly}
                    </td>
                    <td className="bg-gradient-to-r from-pink-500 to-violet-400 bg-clip-text px-7 py-6 text-base font-semibold text-transparent">
                      {annual}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 text-center">
            
              href={APPLY_URL}
              className="inline-flex h-[50px] items-center gap-2.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-8 text-sm font-semibold text-white shadow-[0_0_50px_rgba(139,92,246,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(139,92,246,0.5)]"
            >
              Partner with verify.trading
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white/20 text-xs">
                →
              </span>
            </a>
            <p className="mt-4 text-xs text-slate-500">
              *Estimates based on full retention. Actual earnings vary by
              audience and churn.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5 — WHY TRADERS CHOOSE (6 features) */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
              Why it converts
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Why traders choose{" "}
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                verify.trading.
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-400">
              A product that converts because it solves a real problem. Easy for
              your audience to say yes to.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "🛡️",
                title: "Broker verification",
                body: "Help traders avoid scams. Verify brokers, regulations, and licensing instantly with live data.",
              },
              {
                icon: "📈",
                title: "Signal authenticity",
                body: "Cut through the noise. Verify trading signals against real market data — no fake promises.",
              },
              {
                icon: "⚡",
                title: "Live market data",
                body: "Real-time data and AI-powered checks. No stale info, no guesswork — answers in seconds.",
              },
              {
                icon: "💸",
                title: "Affordable pricing",
                body: "£5 first-month launch offer makes it an easy yes. Low barrier = higher conversion from your traffic.",
              },
              {
                icon: "🎯",
                title: "Simple onboarding",
                body: "Sign up and get value in minutes. No setup, no friction — just one check and better decisions.",
              },
              {
                icon: "🤝",
                title: "Trader-first product",
                body: "Built by traders, for traders. Your audience will recognise the value the moment they try it.",
              },
            ].map((feat) => (
              <div key={feat.title}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-400/25 bg-gradient-to-br from-pink-500/12 to-violet-500/12 text-2xl">
                  {feat.icon}
                </div>
                <h3 className="mb-2.5 text-lg font-semibold text-white">
                  {feat.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {feat.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — JOIN AS A PARTNER (01/02/03) */}
      <section className="relative px-6 py-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_900px_500px_at_50%_100%,rgba(139,92,246,0.1),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-violet-400">
              Get started
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Join as a{" "}
              <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
                partner today.
              </span>
            </h2>
            <p className="mt-4 text-base text-slate-400">
              You're a few simple steps away from earning your first commission.
            </p>
          </div>

          <div className="relative mt-20">
            <div className="pointer-events-none absolute left-[14%] right-[14%] top-[60px] hidden h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent sm:block" />
            <div className="relative grid grid-cols-1 gap-12 sm:grid-cols-3">
              {[
                {
                  num: "01",
                  title: "Apply in 60 seconds",
                  body: "Sign up, share a few details about your audience, and get approved fast.",
                },
                {
                  num: "02",
                  title: "Share your link",
                  body: "Drop your unique referral link in tweets, Discord, newsletters, videos — anywhere your audience hangs out.",
                },
                {
                  num: "03",
                  title: "Earn every month",
                  body: "30% recurring commission lands in your account every month, for as long as they stay subscribed.",
                },
              ].map((step) => (
                <div key={step.num} className="px-4 text-center">
                  <p className="inline-block bg-gradient-to-b from-pink-500 to-violet-500 bg-clip-text text-7xl font-bold leading-none tracking-tighter text-transparent sm:text-8xl">
                    {step.num}
                  </p>
                  <h3 className="mt-6 text-xl font-semibold text-white sm:text-[22px]">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 text-center">
            
              href={APPLY_URL}
              className="inline-flex h-[54px] items-center gap-2.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-10 text-[15px] font-semibold text-white shadow-[0_0_60px_rgba(139,92,246,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_0_70px_rgba(139,92,246,0.55)]"
            >
              Partner with verify.trading
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[13px]">
                →
              </span>
            </a>
            <p className="mt-5 text-sm text-slate-500">
              Questions? Email{" "}
              
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-violet-400 transition hover:text-pink-400"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
