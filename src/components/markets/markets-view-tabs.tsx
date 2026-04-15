"use client";

import type { ReactNode } from "react";
import { Calendar, ChevronDown, LineChart, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MarketsTabId = "charts" | "intelligence" | "calendar";

const TABS: {
  id: MarketsTabId;
  label: string;
  shortLabel: string;
  icon: typeof LineChart;
}[] = [
  { id: "charts", label: "Charts", shortLabel: "Charts", icon: LineChart },
  { id: "intelligence", label: "Market Intelligence", shortLabel: "Intelligence", icon: Newspaper },
  { id: "calendar", label: "Economic Calendar", shortLabel: "Calendar", icon: Calendar },
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
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0]!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="mb-8">
      <div className="mb-6 md:hidden">
        <div className="relative">
          <label htmlFor="markets-tab-select" className="sr-only">
            Markets view
          </label>
          <select
            id="markets-tab-select"
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as MarketsTabId)}
            className="w-full appearance-none rounded-2xl border border-[color:var(--vt-border)] bg-[var(--vt-card)] px-4 py-3.5 pl-10 text-sm font-bold text-white outline-none transition-colors focus:border-[var(--vt-coral)]"
          >
            {TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ActiveIcon
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--vt-coral)]"
            aria-hidden
          />
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--vt-muted)]"
            aria-hidden
          />
        </div>
      </div>

      <div
        className="mb-8 hidden flex-wrap gap-2 border-b border-white/[0.08] pb-4 md:flex"
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
              variant={isActive ? "default" : "ghost"}
              onClick={() => onTabChange(t.id)}
              className={cn(
                "h-auto rounded-xl px-4 py-2.5 text-[13px] font-semibold",
                !isActive && "text-[var(--vt-muted)] hover:bg-white/[0.06] hover:text-white",
                isActive &&
                  "shadow-[0_4px_16px_rgba(242,109,109,0.35)] hover:brightness-110 focus-visible:ring-[var(--vt-coral)]/35",
              )}
            >
              <Icon size={15} className={isActive ? "text-white" : "text-[var(--vt-muted)]"} aria-hidden />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
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
