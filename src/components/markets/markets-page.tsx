import { SiteNav } from "@/components/site/site-nav";

const marketCards = [
  { name: "GOLD", symbol: "XAU/USD", price: "4,493.20", change: "+1.1%", up: true, points: [4300, 4320, 4335, 4380, 4410, 4460, 4493] },
  { name: "OIL", symbol: "XTI/USD", price: "99.64", change: "+5.46%", up: true, points: [84, 85, 87, 90, 93, 96, 99.64] },
  { name: "BITCOIN", symbol: "BTC/USD", price: "66,194", change: "-3.3%", up: false, points: [70600, 69800, 68900, 67800, 67200, 66700, 66194] },
  { name: "ETHEREUM", symbol: "ETH/USD", price: "1,996", change: "-2.2%", up: false, points: [2240, 2190, 2160, 2120, 2075, 2035, 1996] },
  { name: "EUR/USD", symbol: "EUR/USD", price: "1.1510", change: "-0.25%", up: false, points: [1.1602, 1.1584, 1.1565, 1.1541, 1.1534, 1.1521, 1.151] },
  { name: "GBP/USD", symbol: "GBP/USD", price: "1.2940", change: "-0.18%", up: false, points: [1.3018, 1.3009, 1.2992, 1.2974, 1.2962, 1.2951, 1.294] },
  { name: "DOW JONES", symbol: "DJI", price: "45,166", change: "-1.73%", up: false, points: [46150, 45900, 45780, 45660, 45510, 45280, 45166] },
  { name: "NASDAQ", symbol: "IXIC", price: "20,948", change: "-2.15%", up: false, points: [21680, 21450, 21390, 21210, 21150, 21010, 20948] },
];

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const width = 260;
  const height = 96;
  const left = 0;
  const top = 8;
  const innerWidth = width;
  const innerHeight = height - top * 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = left + (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = top + innerHeight - ((point - min) / range) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <path
        d={path}
        fill="none"
        stroke={up ? "var(--vt-green)" : "var(--vt-coral)"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketsPage() {
  return (
    <div className="min-h-screen bg-[var(--vt-navy)] text-white">
      <SiteNav />
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <div className="rounded-2xl border border-[rgba(242,109,109,0.25)] bg-[rgba(242,109,109,0.08)] px-4 py-3 text-sm font-bold text-[var(--vt-coral)]">
          High-impact event watch: NFP and Fed commentary remain the key volatility drivers.
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {marketCards.map((market) => (
            <div
              key={market.name}
              className="rounded-[28px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-4 shadow-[0_18px_48px_rgba(10,13,46,0.28)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                    {market.name}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[var(--vt-muted)]">
                    {market.symbol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black tracking-[-0.04em] text-white">
                    {market.price}
                  </div>
                  <div
                    className={`text-sm font-bold ${
                      market.up ? "text-[var(--vt-green)]" : "text-[var(--vt-coral)]"
                    }`}
                  >
                    {market.change}
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-[color:var(--vt-border)] pt-4">
                <Sparkline points={market.points} up={market.up} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

