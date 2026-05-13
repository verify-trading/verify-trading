"use client";

import type { ReactNode } from "react";
import { BookOpen, Brain, Calendar, LineChart, Lock, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MarketsTabId = "charts" | "intelligence" | "calendar" | "journal" | "mind";

const TABS: {
  id: MarketsTabId;
  label: string;
  icon: typeof LineChart;
  locked?: boolean;
}[] = [
  { id: "charts", label: "Markets", icon: LineChart },
  { id: "intelligence", label: "Intelligence", icon: Newspaper },
  { id: "calendar", label: "Economic Calendar", icon: Calendar },
  { id: "journal", label: "Journal", icon: BookOpen, locked: true },
  { id: "mind", label: "Mind", icon: Brain, locked: true },
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
  children: ReactNode;
};

export function MarketsViewTabs({ activeTab, onTabChange, children }: MarketsViewTabsProps) {
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
              {t.locked ? <Lock size={13} className="text-[var(--vt-muted)]" aria-hidden /> : null}
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
