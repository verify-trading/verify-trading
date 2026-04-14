"use client";

import { MessageSquarePlus, PanelLeftClose, PanelLeft, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AskSessionListSkeleton,
  AskSessionLoadMoreSkeleton,
} from "@/components/ask/ask-skeletons";
import { Button } from "@/components/ui/button";
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
  onRequestDeleteSession,
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
  onRequestDeleteSession: (session: { id: string; title: string }) => void;
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

  useEffect(() => {
    if (isCollapsed) {
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCollapsed]);

  const asideClassName = [
    "flex shrink-0 flex-col overflow-hidden py-0",
    "transition-[width] duration-300 ease-out motion-reduce:transition-none",
    isCollapsed ? "lg:w-14" : "lg:w-80 xl:w-96",
    isCollapsed
      ? "max-lg:relative max-lg:w-full max-lg:border-b max-lg:border-white/[0.04]"
      : [
          "max-lg:fixed max-lg:inset-x-0 max-lg:top-[calc(env(safe-area-inset-top)+3.5rem)] max-lg:bottom-0 z-40 max-lg:w-full max-lg:max-h-none max-lg:border-0",
          "max-lg:bg-[var(--vt-navy)] max-lg:shadow-[0_-8px_48px_rgba(0,0,0,0.45)]",
        ].join(" "),
  ].join(" ");

  return (
    <>
      {!isCollapsed ? (
        <Button
          type="button"
          variant="ghost"
          aria-label="Close session list"
          className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 h-auto w-full rounded-none border-0 bg-[rgba(5,8,27,0.72)] p-0 backdrop-blur-[2px] hover:bg-[rgba(5,8,27,0.78)] lg:hidden"
          onClick={onToggleCollapse}
        />
      ) : null}

      <aside className={asideClassName}>
      {/*
        Desktop (lg+): fixed rail (3.5rem) + session list. Collapsing animates width;
        overflow clips the list so it slides in/out. Mobile: stacked; collapsed hides list.
        Inner min-width matches expanded aside per breakpoint so the clip animation stays aligned.
      */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-[20rem] xl:min-w-[24rem] lg:flex-row">
        <div className="flex h-12 shrink-0 flex-row items-center justify-between gap-2 border-white/[0.06] bg-white/[0.02] px-3 py-0 max-lg:border-b lg:h-auto lg:w-14 lg:bg-transparent lg:px-0 lg:py-3 lg:flex-col lg:justify-start lg:gap-3 lg:border-b-0 lg:border-r">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="size-10 rounded-xl text-[var(--vt-muted)] hover:bg-white/5 hover:text-white lg:size-8 lg:rounded-lg"
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <PanelLeft className="size-[18px] lg:size-4" strokeWidth={1.8} aria-hidden />
            ) : (
              <PanelLeftClose className="size-[18px] lg:size-4" strokeWidth={1.8} aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNewSession}
            className="size-10 rounded-xl text-[var(--vt-muted)] hover:bg-white/5 hover:text-white lg:size-8 lg:rounded-lg"
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-[18px] lg:size-4" strokeWidth={1.8} aria-hidden />
          </Button>
        </div>

        <div
          className={[
            "flex min-h-0 min-w-0 flex-1 flex-col",
            isCollapsed ? "max-lg:hidden" : "",
          ].join(" ")}
        >
          <div className="relative mx-3 mb-3 mt-3">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--vt-muted)]"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions…"
              className="block w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[rgba(76,110,245,0.3)] focus:bg-white/[0.05]"
            />
          </div>

          <div
            ref={viewportRef}
            onScroll={maybeLoadMore}
            className="ask-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3 lg:pb-3"
          >
            {isLoading ? (
              <AskSessionListSkeleton />
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
                        <div
                          key={session.id}
                          className={`group/session mb-0.5 flex w-full items-center gap-0.5 rounded-lg transition-all duration-150 ${
                            isActive
                              ? "bg-white/[0.08] text-white"
                              : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                          }`}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onSelectSession(session.id)}
                            aria-label={session.title}
                            aria-pressed={isActive}
                            className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-lg px-2.5 py-2 text-left font-normal hover:bg-transparent"
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] leading-5">
                              {session.title}
                            </span>
                            <span className="shrink-0 text-[10px] tabular-nums text-white/20 opacity-0 transition group-hover/session:opacity-100 max-lg:opacity-100">
                              {formatSessionTime(session.updatedAt)}
                            </span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              onRequestDeleteSession({ id: session.id, title: session.title })
                            }
                            aria-label={`Delete session: ${session.title}`}
                            title="Delete session"
                            className="h-auto shrink-0 rounded-md p-2 text-white/15 opacity-0 hover:bg-white/[0.08] hover:text-[var(--vt-coral)] group-hover/session:opacity-100 focus-visible:opacity-100 max-lg:opacity-100 max-lg:text-white/35"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.8} aria-hidden />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ))
            )}
            {isLoadingMore ? <AskSessionLoadMoreSkeleton /> : null}
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
