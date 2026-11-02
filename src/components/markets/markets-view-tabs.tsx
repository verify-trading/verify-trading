"use client";

import type { ComponentType, ReactNode } from "react";
import { Calendar, FingerprintPattern, LineChart, Lock, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The app's Journal tab glyph (mobile src/navigation/TabIcons.tsx), on lucide's 24-unit contract. */
export function JournalIcon({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14.5 2.5H8a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2V7.5z" />
      <path d="M14.5 2.5v3a2 2 0 0 0 2 2h3" />
      <path d="M3.5 6.5H7M3.5 10.2H7M3.5 13.9H7M3.5 17.6H7" />
      <path d="m10 14 2.4 2.4 4.6-5" />
    </svg>
  );
}

export type MarketsTabId = "charts" | "intelligence" | "calendar" | "journal" | "mind";

const TABS: {
  id: MarketsTabId;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "charts", label: "Markets", icon: LineChart },
  { id: "intelligence", label: "Intelligence", icon: Newspaper },
  { id: "calendar", label: "Economic Calendar", icon: Calendar },
  { id: "journal", label: "Journal", icon: JournalIcon },
  { id: "mind", label: "Mind", icon: FingerprintPattern },
];

function tabPanelId(tab: MarketsTabId): string {
  return `markets-tab-${tab}-panel`;
}

function tabButtonId(tab: MarketsTabId): string {
  return `markets-tab-${tab}-trigger`;
}

export type MarketsViewTabsProps = {
  activeTab: MarketsTabId;
  onTabChange: (tab: MarketsTabId) => void;
  lockedTabs?: MarketsTabId[];
  children: ReactNode;
};

export function MarketsViewTabs({
  activeTab,
  onTabChange,
  lockedTabs = [],
  children,
}: MarketsViewTabsProps) {
  return (
    <div className="mb-8">
      <div
        className="mb-7 flex items-center gap-1 overflow-x-auto border-b border-white/[0.08] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Markets tabs"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === activeTab;
          const isLocked = lockedTabs.includes(t.id);
          return (
            <Button
              key={t.id}
              id={tabButtonId(t.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={tabPanelId(t.id)}
              tabIndex={isActive ? 0 : -1}
              variant="ghost"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "relative h-auto shrink-0 rounded-none border-0 bg-transparent px-3 pb-4 pt-1 text-sm font-semibold shadow-none hover:bg-transparent",
                !isActive && "text-[var(--vt-muted)] hover:text-white",
                isActive &&
                  "text-white after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[var(--vt-coral)]",
              )}
            >
              <Icon size={16} className={isActive ? "text-[var(--vt-coral)]" : "text-[var(--vt-muted)]"} aria-hidden />
              {t.label}
              {isLocked ? <Lock size={13} className="text-[var(--vt-muted)]" aria-hidden /> : null}
            </Button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={tabPanelId(activeTab)}
        aria-labelledby={tabButtonId(activeTab)}
        className="min-w-0"
      >
        {children}
      </div>
    </div>
  );
}
