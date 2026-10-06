import { CalendarClock, FingerprintPattern, MessagesSquare, ShieldCheck, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { AskNavIcon, MarketsNavIcon } from "@/components/site/site-nav";

/**
 * Feature icons, matching the mobile app (verify-trading-mobile: TabIcons.tsx, GlassTabBar.tsx).
 * Ask / Markets reuse the glyphs already in site-nav; Journal is the app's custom glyph; the rest are the same lucide icons the app uses.
 */
export type AppIconProps = SVGProps<SVGSVGElement>;

function Icon(props: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

export function JournalIcon(props: AppIconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 2.5H8a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2V7.5z" />
      <path d="M14.5 2.5v3a2 2 0 0 0 2 2h3" />
      <path d="M3.5 6.5H7" />
      <path d="M3.5 10.2H7" />
      <path d="M3.5 13.9H7" />
      <path d="M3.5 17.6H7" />
      <path d="m10 14 2.4 2.4 4.6-5" />
    </Icon>
  );
}

export type AppIconKey = "verify" | "ask" | "markets" | "intelligence" | "calendar" | "journal" | "mind" | "community";

export const APP_ICONS: Record<AppIconKey, ComponentType<AppIconProps & { size?: number | string }>> = {
  verify: ShieldCheck,
  ask: AskNavIcon,
  markets: MarketsNavIcon,
  intelligence: Sparkles,
  calendar: CalendarClock,
  journal: JournalIcon,
  mind: FingerprintPattern,
  community: MessagesSquare,
};
