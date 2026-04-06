"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeft, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AskSessionListItem } from "@/lib/ask/contracts";

function formatSessionTime(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function groupLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "Other";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

export function AskSessionSidebar({
  sessions,
  activeSessionId,
  isLoading,
  isLoadingMore,
  hasMore,
  onNewSession,
  onLoadMore,
  onSelectSession,
  isCollapsed,
  onToggleCollapse,
}: {
  sessions: AskSessionListItem[];
  activeSessionId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onNewSession: () => void;
  onLoadMore: () => void;
  onSelectSession: (sessionId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, AskSessionListItem[]> = {};
    for (const session of filteredSessions) {
      const label = groupLabel(session.updatedAt);
      (groups[label] ??= []).push(session);
    }
    return groups;
  }, [filteredSessions]);

  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  const maybeLoadMore = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || isLoading || isLoadingMore || !hasMore) {
      return;
    }

    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (remaining <= 48) {
      onLoadMore();
    }
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  useEffect(() => {
    maybeLoadMore();
  }, [filteredSessions.length, maybeLoadMore]);

  if (isCollapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-3 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--vt-muted)] transition hover:bg-white/5 hover:text-white"
          aria-label="Open sidebar"
        >
          <PanelLeft className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--vt-muted)] transition hover:bg-white/5 hover:text-white"
          aria-label="New chat"
        >
          <MessageSquarePlus className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-full shrink-0 flex-col py-3 max-lg:max-h-48 max-lg:border-b max-lg:border-white/[0.04] lg:w-72 xl:w-[17.5rem]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--vt-muted)] transition hover:bg-white/5 hover:text-white"
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="size-4" strokeWidth={1.8} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--vt-muted)] transition hover:bg-white/5 hover:text-white"
          aria-label="New chat"
        >
          <MessageSquarePlus className="size-4" strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      {/* Search */}
      <div className="relative mx-3 mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--vt-muted)]" strokeWidth={2} aria-hidden />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions…"
          className="block w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[rgba(76,110,245,0.3)] focus:bg-white/[0.05]"
        />
      </div>

      {/* Session list */}
      <div
        ref={viewportRef}
        onScroll={maybeLoadMore}
        className="ask-scrollbar min-h-0 flex-1 overflow-y-auto px-2"
      >
        {isLoading ? (
          <div className="px-2 py-4 text-center text-xs font-medium text-white/30">
            Loading…
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs font-medium text-white/30">
            {searchQuery ? "No matches" : "No sessions yet"}
          </div>
        ) : (
          groupOrder
            .filter((label) => grouped[label]?.length)
            .map((label) => (
              <div key={label} className="mb-3">
                <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
                  {label}
                </div>
                {grouped[label]!.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      aria-label={session.title}
                      aria-pressed={isActive}
                      className={`group mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all duration-150 ${
                        isActive
                          ? "bg-white/[0.08] text-white"
                          : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-5">
                        {session.title}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-white/20 opacity-0 transition group-hover:opacity-100">
                        {formatSessionTime(session.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
        )}
        {isLoadingMore ? (
          <div className="flex items-center justify-center gap-2 px-2 py-3 text-xs font-medium text-white/35">
            <span className="inline-flex size-3.5 animate-spin rounded-full border border-white/15 border-t-[var(--vt-blue)]" />
            Loading more…
          </div>
        ) : null}
      </div>
    </aside>
  );
}
