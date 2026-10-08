import { Brain, Gauge, LineChart, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";

import type { BlogCategory } from "@/lib/blog/categories";
import { cn } from "@/lib/utils";

/** Per-category thumbnail: gradient + icon, no stock photos. Colours stay inside the site palette. */
export const CATEGORY_THEME: Record<BlogCategory, { icon: LucideIcon; gradient: string; chip: string }> = {
  "Broker safety": {
    icon: ShieldCheck,
    gradient: "from-[#1d2b7a] via-[#2f47b8] to-[#4c6ef5]",
    chip: "text-[#9db0ff]",
  },
  "Prop firms": {
    icon: Trophy,
    gradient: "from-[#3b1a7a] via-[#6d3bd1] to-[#a78bfa]",
    chip: "text-violet-300",
  },
  "Risk management": {
    icon: Gauge,
    gradient: "from-[#5a1f2e] via-[#b2445a] to-[#f26d6d]",
    chip: "text-[#ff9b9b]",
  },
  "Trading psychology": {
    icon: Brain,
    gradient: "from-[#4a1650] via-[#9b2f86] to-[#f472b6]",
    chip: "text-pink-300",
  },
  "Markets and news": {
    icon: LineChart,
    gradient: "from-[#0b3b3a] via-[#11735f] to-[#22c55e]",
    chip: "text-emerald-300",
  },
};

export function BlogThumb({ category, large = false, className }: { category: BlogCategory; large?: boolean; className?: string }) {
  const { icon: Icon, gradient } = CATEGORY_THEME[category];
  return (
    <div aria-hidden className={cn("relative overflow-hidden bg-gradient-to-br", gradient, className)}>
      {/* soft grid + glow so the flat gradient reads as a designed surface */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-white backdrop-blur-sm",
            large ? "size-20" : "size-14",
          )}
        >
          <Icon className={large ? "size-10" : "size-7"} strokeWidth={1.6} />
        </span>
      </div>
    </div>
  );
}
