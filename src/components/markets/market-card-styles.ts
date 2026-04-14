import { cn } from "@/lib/utils";

/** Shared shell for grid cards and loading skeletons (selected / unselected). */
export function marketCardSurfaceClass(isSelected: boolean) {
  return cn(
    "flex h-auto w-full min-w-0 flex-col items-stretch self-start rounded-[22px] border p-0 text-left font-normal shadow-[0_8px_32px_rgba(0,0,0,0.22)] transition-all duration-200 group",
    isSelected
      ? "border-[rgba(76,110,245,0.45)] bg-gradient-to-b from-[rgba(76,110,245,0.1)] to-transparent shadow-[0_12px_44px_rgba(76,110,245,0.14)] ring-1 ring-[rgba(76,110,245,0.25)]"
      : "border-white/[0.09] bg-[var(--vt-card)]",
  );
}

/** Lift + shadow on hover (all interactive cards). */
export const marketCardLiftHoverClass = "hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)]";

/** Extra hover for unselected cards only (selected keeps border). */
export const marketCardUnselectedHoverClass = "hover:border-white/[0.14] hover:bg-[var(--vt-card-alt)]";
