import { Brain, Gauge, LineChart, ShieldCheck, Trophy, type LucideIcon } from "lucide-react";

import type { BlogCategory } from "@/lib/blog/categories";
import { cn } from "@/lib/utils";

/** Per-category accent. Covers stay dark (navy base) so the brand reads first, the colour second. */
export const CATEGORY_THEME: Record<BlogCategory, { icon: LucideIcon; glow: string; chip: string }> = {
  "Broker safety": { icon: ShieldCheck, glow: "rgba(76,110,245,0.55)", chip: "text-[#9db0ff]" },
  "Prop firms": { icon: Trophy, glow: "rgba(139,92,246,0.55)", chip: "text-violet-300" },
  "Risk management": { icon: Gauge, glow: "rgba(242,109,109,0.5)", chip: "text-[#ff9b9b]" },
  "Trading psychology": { icon: Brain, glow: "rgba(236,72,153,0.45)", chip: "text-pink-300" },
  "Markets and news": { icon: LineChart, glow: "rgba(34,197,94,0.4)", chip: "text-emerald-300" },
};

/**
 * Article cover. A real image when the article has one (BabyLoveGrowth), otherwise a designed cover:
 * navy base, category glow, faint grid, category chip and the title set large (Mobbin: Replit, Linear blogs).
 */
export function BlogThumb({
  category,
  title,
  image,
  size = "card",
  className,
}: {
  category: BlogCategory;
  title?: string;
  image?: string | null;
  size?: "card" | "feature" | "banner";
  className?: string;
}) {
  if (image) {
    return (
      <div className={cn("relative overflow-hidden bg-[var(--vt-card)]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote CMS cover, host varies */}
        <img src={image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      </div>
    );
  }

  const { icon: Icon, glow } = CATEGORY_THEME[category];
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-[#0d1140]", className)}
      style={{ backgroundImage: `radial-gradient(120% 90% at 85% 0%, ${glow}, transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(76,110,245,0.18), transparent 60%)` }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <Icon
        className={cn(
          "absolute text-white/[0.07] transition duration-500 group-hover:text-white/[0.1]",
          size === "card" ? "-right-6 -top-6 size-40" : "-right-10 -top-10 size-64",
        )}
        strokeWidth={1.2}
      />
      <div className={cn("relative flex h-full flex-col justify-between", size === "card" ? "p-5" : "p-6 sm:p-8")}>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
          <Icon className="size-3.5" strokeWidth={2} />
          {category}
        </span>
        {title ? (
          <p
            className={cn(
              "max-w-[22ch] font-semibold leading-[1.15] tracking-tight text-white",
              size === "card" ? "line-clamp-3 text-xl" : size === "feature" ? "line-clamp-3 text-2xl sm:text-[2rem]" : "line-clamp-2 text-2xl sm:text-4xl",
            )}
          >
            {title}
          </p>
        ) : null}
      </div>
    </div>
  );
}
