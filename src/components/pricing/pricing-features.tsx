import { APP_ICONS, type AppIconKey } from "@/components/icons/app-icons";
import { PRO_DAILY_ASK_LIMIT } from "@/lib/rate-limit/usage";

const FEATURES: Array<{ icon: AppIconKey; name: string; benefit: string; body: string }> = [
  { icon: "verify", name: "Verify", benefit: "Avoid funding a scam account before it's too late.", body: "Trust scores for brokers, prop firms & educators — regulation, status and warnings, all cited to source." },
  { icon: "calendar", name: "Economic Calendar", benefit: "The news event that wipes accounts — flagged before it hits.", body: "CPI, NFP, FOMC and more, with impact levels and alerts before high-impact events." },
  { icon: "ask", name: "Ask", benefit: "Stop taking bad setups that cost you the session.", body: `AI assistant with evidence-based answers — the reasoning behind a setup, not just an answer. ${PRO_DAILY_ASK_LIMIT} chats per day.` },
  { icon: "journal", name: "Journal", benefit: "Find the leak in your trading before it empties the account.", body: "Trade tracking, performance analytics, and Challenge Mode built for prop firm evaluations." },
  { icon: "markets", name: "Markets", benefit: "See the move before you miss it.", body: "Real-time prices and watchlists across gold, bitcoin, forex pairs and indices." },
  { icon: "mind", name: "Mind", benefit: "Cut the revenge trades and tilt that drain your balance.", body: "Psychology coaching for discipline, emotional control and focus — the part no indicator covers." },
  { icon: "intelligence", name: "Intelligence", benefit: "One complete picture, so you never trade a single signal.", body: "Combines verification, market data and AI analysis into a full market view." },
  { icon: "community", name: "Members Community", benefit: "Trade next to people who've passed the challenges you're facing.", body: "Priority support and exclusive community access." },
];

/** "Everything included" grid. Presentation only: benefit + description per Pro feature, no usage statistics. */
export function PricingFeatures() {
  return (
    <div className="mt-12">
      <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Everything included — and what it earns you back
      </h2>
      <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = APP_ICONS[f.icon];
          return (
            <li key={f.name} className="flex gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[var(--vt-blue)]/40 bg-[var(--vt-blue)]/10 text-[var(--vt-blue)]">
                <Icon className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] leading-snug text-white">
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-slate-400"> → </span>
                  <span className="font-semibold">{f.benefit}</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{f.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
