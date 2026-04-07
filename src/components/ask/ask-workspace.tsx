"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

import {
  extractAssistantCard,
  extractSessionData,
  extractUiMeta,
  getAssistantTextPreview,
  deleteAskSession,
  fetchHistoryPage,
  fetchSessionList,
  fileToDataUrl,
  isDefined,
  suggestionPrompts,
  type AskChatMessage,
} from "@/components/ask/ask-chat-helpers";
import { createAskChatFetch } from "@/components/ask/ask-chat-fetch";
import { AskComposer } from "@/components/ask/ask-composer";
import { AskEmptyState } from "@/components/ask/ask-empty-state";
import { AskImageModal } from "@/components/ask/ask-image-modal";
import { AskSessionSidebar } from "@/components/ask/ask-session-sidebar";
import { Modal } from "@/components/ui/modal";
import { AskThread } from "@/components/ask/ask-thread";
import {
  mapPersistedMessageToStoreMessage,
  useAskStore,
} from "@/components/ask/store";
import { useVisualViewportKeyboardInset } from "@/components/ask/use-visual-viewport-keyboard-inset";
import { SiteNav } from "@/components/site/site-nav";
import {
  ASK_USER_MESSAGE_INVALID_RESPONSE,
  getUserMessageFromAskChatError,
} from "@/lib/ask/ask-failure";
import { ASK_ATTACHMENT_MAX_BYTES } from "@/lib/ask/config";
import type { AskSessionListItem } from "@/lib/ask/contracts";
import { defaultAskImagePrompt } from "@/lib/ask/prompt";
import {
  ASK_PINNED_THRESHOLD_PX,
  isPinnedNearBottom,
} from "@/lib/ask/scroll-thread";
import { askToolStatusSchema, type AskToolStatus } from "@/lib/ask/stream";
import { logger } from "@/lib/observability/logger";

const ASK_SESSION_PAGE_SIZE = 40;

function parseUrlSessionId(value: string | null) {
  if (!value) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

function inferSessionTitle(message: string) {
  return message.trim().slice(0, 80) || "New Ask Session";
}

function inferSessionTitleFromSubmission(message: string, attachmentFileName?: string | null) {
  const trimmedMessage = message.trim();
  if (trimmedMessage) {
    return inferSessionTitle(trimmedMessage);
  }

  const trimmedAttachmentName = attachmentFileName?.trim();
  if (trimmedAttachmentName) {
    return inferSessionTitle(trimmedAttachmentName);
  }

  return "Chart Upload";
}

function buildInitialToolStatus(hasImage: boolean): AskToolStatus {
  return {
    id: crypto.randomUUID(),
    phase: "thinking",
    label: hasImage ? "Reading your chart" : "Thinking through your question",
    detail: hasImage
      ? "Pulling context from the uploaded image before answering."
      : "Deciding which checks or live tools are actually needed.",
  };
}

export function AskWorkspace({
  initialUrlSessionId = null,
}: {
  initialUrlSessionId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSessionId =
    parseUrlSessionId(searchParams.get("session")) ?? parseUrlSessionId(initialUrlSessionId);
  const [activeImagePreview, setActiveImagePreview] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [sessions, setSessions] = useState<AskSessionListItem[]>([]);
  const [sessionsCursor, setSessionsCursor] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  /** Mobile: start collapsed so chat gets the viewport; desktop expands after mount. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const collapseSidebarIfMobile = useCallback(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      setSidebarCollapsed(false);
    }
  }, []);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const threadBottomRef = useRef<HTMLDivElement | null>(null);
  const hasSyncedUrlSessionRef = useRef(false);
  const pendingUrlSessionRef = useRef<string | null | undefined>(undefined);
  /** True while store is cleared to null but `?session=` may still be stale for a frame — avoid URL "resolving" skeleton. */
  const clearingAskUrlSessionRef = useRef(false);
  const hydratedSessionRef = useRef<string | null>(null);
  const pendingAssistantAttachmentRef = useRef<string | undefined>(undefined);
  const pendingSessionTitleRef = useRef<string | null>(null);
  const pendingRequestRef = useRef(false);
  const pendingPrependRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const composerStripRef = useRef<HTMLDivElement | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [composerStripHeight, setComposerStripHeight] = useState(0);
  const [liveToolStatuses, setLiveToolStatuses] = useState<AskToolStatus[]>([]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobileLayout(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Only while Ask is mounted (this component). Cleanup restores html/body so other routes keep normal scroll.
  useEffect(() => {
    if (!isMobileLayout || typeof document === "undefined") {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    window.scrollTo(0, 0);

    const fixWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    const vv = window.visualViewport;
    vv?.addEventListener("scroll", fixWindowScroll);
    window.addEventListener("scroll", fixWindowScroll, { passive: true });

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
      vv?.removeEventListener("scroll", fixWindowScroll);
      window.removeEventListener("scroll", fixWindowScroll);
    };
  }, [isMobileLayout]);

  const {
    draft,
    attachment,
    error,
    messages,
    historyCursor,
    isLoadingHistory,
    isLoadingOlder,
    sessionId,
    setDraft,
    setAttachment,
    clearAttachment,
    setSessionId,
    openSession,
    setError,
    startHistoryLoad,
    finishHistoryLoad,
    startOlderLoad,
    finishOlderLoad,
    hydrateThread,
    prependHistoryPage,
    appendUserMessage,
    appendAssistantCard,
    historyWindow,
  } = useAskStore();

  const keyboardInsetPx = useVisualViewportKeyboardInset(isMobileLayout);

  useLayoutEffect(() => {
    const el = composerStripRef.current;
    if (!el) {
      return;
    }

    const measure = () => {
      setComposerStripHeight(el.getBoundingClientRect().height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobileLayout, error, draft, attachment, messages.length]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AskChatMessage>({
        api: "/api/ask",
        fetch: createAskChatFetch(),
      }),
    [],
  );

  const { sendMessage, setMessages: clearTransportMessages, status } =
    useChat<AskChatMessage>({
      transport,
      onData: (dataPart) => {
        if (dataPart.type !== "data-tool-status") {
          return;
        }

        const parsed = askToolStatusSchema.safeParse(dataPart.data);
        if (!parsed.success) {
          return;
        }

        setLiveToolStatuses((current) => {
          const previous = current[current.length - 1];
          if (
            previous &&
            previous.label === parsed.data.label &&
            previous.phase === parsed.data.phase &&
            previous.detail === parsed.data.detail
          ) {
            return current;
          }

          return [...current.slice(-3), parsed.data];
        });
      },
      onFinish: ({ message }) => {
        const card = extractAssistantCard(message);
        const sessionData = extractSessionData(message);
        const attachmentPreviewUrl = pendingAssistantAttachmentRef.current;

        setLiveToolStatuses([]);
        pendingRequestRef.current = false;
        clearTransportMessages([]);

        if (!card) {
          pendingSessionTitleRef.current = null;
          pendingAssistantAttachmentRef.current = undefined;
          logger.warn("Ask stream finished without a parseable card.", {
            textPreviewLength: getAssistantTextPreview(message).length,
            textPreview: getAssistantTextPreview(message),
          });
          setError(ASK_USER_MESSAGE_INVALID_RESPONSE);
          scrollToLatest();
          return;
        }

        appendAssistantCard(card, extractUiMeta(message), attachmentPreviewUrl);
        const resolvedSessionId = sessionData?.sessionId ?? useAskStore.getState().sessionId;
        const pendingSessionTitle = pendingSessionTitleRef.current;

        if (resolvedSessionId) {
          setSessionId(resolvedSessionId);
          hydratedSessionRef.current = resolvedSessionId;
          replaceSessionUrl(resolvedSessionId);

          if (pendingSessionTitle) {
            upsertSession(resolvedSessionId, pendingSessionTitle);
          }
        }

        pendingSessionTitleRef.current = null;
        pendingAssistantAttachmentRef.current = undefined;
        scrollToLatest();
      },
      onError: (err) => {
        if (!pendingRequestRef.current) {
          return;
        }

        setLiveToolStatuses([]);
        pendingSessionTitleRef.current = null;
        pendingAssistantAttachmentRef.current = undefined;
        pendingRequestRef.current = false;
        clearTransportMessages([]);
        setError(getUserMessageFromAskChatError(err));
        scrollToLatest();
      },
    });

  const isSubmitting = status === "submitted" || status === "streaming";
  const isOpeningSession = Boolean(sessionId) && messages.length === 0 && !error;
  /** `router.replace` can lag `useSearchParams`; store already matches `pendingUrlSessionRef`. */
  const urlCatchingUpToStore =
    sessionId !== null &&
    pendingUrlSessionRef.current === sessionId &&
    pendingUrlSessionRef.current !== null &&
    urlSessionId !== sessionId;
  const isResolvingUrlSession =
    Boolean(urlSessionId) &&
    messages.length === 0 &&
    !error &&
    !clearingAskUrlSessionRef.current &&
    !urlCatchingUpToStore &&
    (sessionId !== urlSessionId || hydratedSessionRef.current !== urlSessionId);

  const upsertSession = useCallback((nextSessionId: string, title: string) => {
    const updatedAt = new Date().toISOString();

    setSessions((currentSessions) => [
      {
        id: nextSessionId,
        title,
        updatedAt,
      },
      ...currentSessions.filter((session) => session.id !== nextSessionId),
    ]);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const page = await fetchSessionList(ASK_SESSION_PAGE_SIZE);
      setSessions(page.sessions);
      setSessionsCursor(page.nextCursor);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const loadMoreSessions = useCallback(async () => {
    if (!sessionsCursor || isLoadingSessions || isLoadingMoreSessions) {
      return;
    }

    setIsLoadingMoreSessions(true);

    try {
      const page = await fetchSessionList(ASK_SESSION_PAGE_SIZE, sessionsCursor);
      setSessions((currentSessions) => [
        ...currentSessions,
        ...page.sessions.filter(
          (nextSession) =>
            !currentSessions.some((currentSession) => currentSession.id === nextSession.id),
        ),
      ]);
      setSessionsCursor(page.nextCursor);
    } finally {
      setIsLoadingMoreSessions(false);
    }
  }, [isLoadingMoreSessions, isLoadingSessions, sessionsCursor]);

  const replaceSessionUrl = useCallback((nextSessionId: string | null) => {
    pendingUrlSessionRef.current = nextSessionId;
    const params = new URLSearchParams(searchParams.toString());
    if (nextSessionId) {
      params.set("session", nextSessionId);
    } else {
      params.delete("session");
    }

    const nextUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const activateSession = useCallback((nextSessionId: string | null) => {
    pendingSessionTitleRef.current = null;
    pendingAssistantAttachmentRef.current = undefined;
    pendingRequestRef.current = false;
    clearTransportMessages([]);
    hydratedSessionRef.current = null;
    if (nextSessionId === null) {
      clearingAskUrlSessionRef.current = true;
    } else {
      clearingAskUrlSessionRef.current = false;
    }
    openSession(nextSessionId);
    replaceSessionUrl(nextSessionId);
  }, [clearTransportMessages, openSession, replaceSessionUrl]);

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteConfirm) {
      return;
    }

    setIsDeletingSession(true);
    setError(null);
    const targetId = deleteConfirm.id;

    try {
      await deleteAskSession(targetId);
      setDeleteConfirm(null);
      if (sessionId === targetId) {
        activateSession(null);
      }
      await refreshSessions();
    } catch {
      setError("Could not delete that session.");
    } finally {
      setIsDeletingSession(false);
    }
  }, [activateSession, deleteConfirm, refreshSessions, sessionId, setError]);

  function openImagePreview(src: string, alt: string) {
    setActiveImagePreview({ src, alt });
  }

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const viewport = threadViewportRef.current;
      if (!viewport || useAskStore.getState().messages.length === 0) {
        return;
      }

      const scrollToBottom = () => {
        const top = viewport.scrollHeight;
        if (typeof viewport.scrollTo === "function") {
          viewport.scrollTo({ top, behavior });
          return;
        }

        viewport.scrollTop = top;
      };

      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
  }

  /**
   * Images used to call scroll on every decode, which yanked the viewport to the bottom
   * even while reading older messages. Only nudge scroll if the user is already near the end.
   */
  function scrollToLatestIfPinned(behavior: ScrollBehavior = "auto") {
    const viewport = threadViewportRef.current;
    if (!viewport || useAskStore.getState().messages.length === 0) {
      return;
    }

    if (!isPinnedNearBottom(viewport, ASK_PINNED_THRESHOLD_PX)) {
      return;
    }

    requestAnimationFrame(() => {
      const v = threadViewportRef.current;
      if (!v) {
        return;
      }

      const top = v.scrollHeight;
      if (typeof v.scrollTo === "function") {
        v.scrollTo({ top, behavior });
      } else {
        v.scrollTop = top;
      }
    });
  }

  async function loadOlderMessages() {
    if (!sessionId || !historyCursor || isLoadingOlder) {
      return;
    }

    startOlderLoad();
    const viewport = threadViewportRef.current;
    if (viewport) {
      pendingPrependRef.current = {
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
    }

    try {
      const page = await fetchHistoryPage(sessionId, historyCursor);
      prependHistoryPage(
        page.messages.map(mapPersistedMessageToStoreMessage).filter(isDefined),
        page.nextCursor,
      );
    } catch {
      finishOlderLoad();
      setError("Could not load older Ask messages.");
    }
  }

  async function submit(promptOverride?: string) {
    const nextPrompt = (promptOverride ?? draft).trim();
    const submittedPrompt = nextPrompt || (attachment ? defaultAskImagePrompt : "");
    const displayPrompt = nextPrompt;
    if (!submittedPrompt || isSubmitting) {
      return;
    }

    setError(null);

    try {
      const currentAttachment = attachment;
      const image = currentAttachment ? await fileToDataUrl(currentAttachment.file) : null;

      pendingSessionTitleRef.current = inferSessionTitleFromSubmission(
        displayPrompt,
        currentAttachment?.file.name ?? null,
      );
      pendingAssistantAttachmentRef.current = image ?? undefined;
      pendingRequestRef.current = true;
      setLiveToolStatuses([buildInitialToolStatus(Boolean(image))]);

      appendUserMessage(
        displayPrompt,
        currentAttachment?.file.name ?? null,
        image ?? undefined,
      );
      setDraft("");
      clearAttachment();
      scrollToLatest();

      await sendMessage(
        { text: submittedPrompt },
        {
          body: {
            message: submittedPrompt,
            image,
            sessionId,
            attachmentMeta: currentAttachment
              ? {
                  fileName: currentAttachment.file.name,
                  mimeType: currentAttachment.file.type,
                  size: currentAttachment.file.size,
                }
              : null,
            history: historyWindow(),
          },
        },
      );
    } catch {
      setLiveToolStatuses([]);
      pendingSessionTitleRef.current = null;
      pendingAssistantAttachmentRef.current = undefined;
      pendingRequestRef.current = false;
      clearTransportMessages([]);
      setError("Could not send that message. Please try again.");
      scrollToLatest();
    }
  }

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
    },
    maxFiles: 1,
    maxSize: ASK_ATTACHMENT_MAX_BYTES,
    noClick: true,
    noKeyboard: true,
    disabled: isSubmitting,
    onDropAccepted: ([file]) => {
      setAttachment({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    },
    onDropRejected: () => {
      setError("Use one PNG, JPEG, or WebP image up to 5MB.");
    },
  });
  const { className: dropzoneClassName, ...dropzoneRootProps } = getRootProps() as {
    className?: string;
  } & Record<string, unknown>;

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (sessionId === null && urlSessionId === null) {
      clearingAskUrlSessionRef.current = false;
    }
  }, [sessionId, urlSessionId]);

  useEffect(() => {
    if (pendingUrlSessionRef.current !== undefined) {
      if (urlSessionId === pendingUrlSessionRef.current) {
        pendingUrlSessionRef.current = undefined;
      } else {
        return;
      }
    }

    if (!hasSyncedUrlSessionRef.current) {
      hasSyncedUrlSessionRef.current = true;
      if (urlSessionId !== sessionId) {
        openSession(urlSessionId);
      }
      return;
    }

    if (urlSessionId !== sessionId) {
      openSession(urlSessionId);
    }
  }, [openSession, sessionId, urlSessionId]);

  useEffect(() => {
    if (!sessionId || messages.length > 0 || hydratedSessionRef.current === sessionId) {
      return;
    }

    let cancelled = false;

    async function restoreSession(activeSessionId: string) {
      startHistoryLoad();

      try {
        const page = await fetchHistoryPage(activeSessionId);
        if (cancelled) {
          finishHistoryLoad();
          return;
        }

        if (page.messages.length === 0) {
          const state = useAskStore.getState();
          if (state.sessionId === activeSessionId && state.messages.length === 0) {
            activateSession(null);
          }
          finishHistoryLoad();
          hydratedSessionRef.current = null;
          return;
        }

        const state = useAskStore.getState();
        if (state.sessionId !== activeSessionId || state.messages.length > 0) {
          finishHistoryLoad();
          return;
        }

        hydrateThread(
          page.messages.map(mapPersistedMessageToStoreMessage).filter(isDefined),
          page.nextCursor,
        );
        hydratedSessionRef.current = activeSessionId;
        scrollToLatest("auto");
      } catch {
        if (!cancelled) {
          finishHistoryLoad();
          setError("Could not restore this Ask session.");
        }
      }
    }

    void restoreSession(sessionId);

    return () => {
      cancelled = true;
    };
  }, [
    activateSession,
    finishHistoryLoad,
    hydrateThread,
    messages.length,
    sessionId,
    setError,
    startHistoryLoad,
  ]);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    scrollToLatest();
  }, [isSubmitting]);

  useEffect(() => {
    const pendingPrepend = pendingPrependRef.current;
    const viewport = threadViewportRef.current;
    if (!pendingPrepend || !viewport) {
      return;
    }

    requestAnimationFrame(() => {
      const heightDelta = viewport.scrollHeight - pendingPrepend.scrollHeight;
      viewport.scrollTop = pendingPrepend.scrollTop + heightDelta;
      pendingPrependRef.current = null;
    });
  }, [messages]);

  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--vt-navy)] text-white">
      <SiteNav />

      <main className="mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col px-0 pb-0 pt-0">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          {/* Sidebar */}
          <AskSessionSidebar
            sessions={sessions}
            activeSessionId={sessionId}
            isLoading={isLoadingSessions}
            isLoadingMore={isLoadingMoreSessions}
            hasMore={Boolean(sessionsCursor)}
            onNewSession={() => {
              activateSession(null);
              collapseSidebarIfMobile();
            }}
            onLoadMore={() => void loadMoreSessions()}
            onSelectSession={(nextSessionId) => {
              activateSession(nextSessionId);
              collapseSidebarIfMobile();
            }}
            onRequestDeleteSession={setDeleteConfirm}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />

          {/* Divider — width transition keeps pace with sidebar slide */}
          <div
            className={[
              "hidden shrink-0 bg-white/[0.04] transition-[width,opacity,margin] duration-300 ease-out motion-reduce:transition-none lg:block",
              sidebarCollapsed ? "w-0 opacity-0" : "w-px opacity-100",
            ].join(" ")}
            aria-hidden
          />

          {/* Chat area */}
          <div
            {...dropzoneRootProps}
            className={[
              dropzoneClassName,
              "relative flex min-h-0 min-w-0 flex-1 flex-col",
              isDragActive ? "bg-[rgba(76,110,245,0.03)]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {isDragActive ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[rgba(10,13,46,0.76)] px-6">
                <div className="rounded-2xl border border-[rgba(76,110,245,0.28)] bg-[rgba(17,22,72,0.92)] px-5 py-4 text-center shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
                  <div className="text-sm font-semibold text-white">
                    Drop chart image to attach
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    PNG, JPEG, or WebP up to 5MB
                  </div>
                </div>
              </div>
            ) : null}

            {/* Thread / Empty state — overflow-hidden stops the empty layout from creating a page-height scroll shell */}
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              style={
                isMobileLayout
                  ? { paddingBottom: composerStripHeight + keyboardInsetPx }
                  : undefined
              }
            >
              {messages.length === 0 ? (
                <AskEmptyState
                  isLoadingHistory={isResolvingUrlSession || isOpeningSession || isLoadingHistory}
                  prompts={suggestionPrompts}
                  onPromptClick={(prompt) => void submit(prompt)}
                />
              ) : (
                <AskThread
                  messages={messages}
                  historyCursor={historyCursor}
                  isLoadingHistory={isLoadingHistory}
                  isLoadingOlder={isLoadingOlder}
                  isSubmitting={isSubmitting}
                  liveToolStatuses={liveToolStatuses}
                  onLoadOlder={() => void loadOlderMessages()}
                  onOpenImage={openImagePreview}
                  onAttachmentLoad={() => scrollToLatestIfPinned("auto")}
                  viewportRef={threadViewportRef}
                  bottomRef={threadBottomRef}
                />
              )}
            </div>

            {/* Composer — fixed on mobile so it sits above the keyboard; shrink-0 on desktop */}
            <div
              ref={composerStripRef}
              className={[
                "border-t border-white/[0.06] bg-[var(--vt-navy)]/95 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl sm:px-6 sm:pb-5 sm:pt-4",
                isMobileLayout
                  ? "fixed left-0 right-0 bottom-0 z-30"
                  : "shrink-0",
              ].join(" ")}
              style={isMobileLayout ? { bottom: keyboardInsetPx } : undefined}
            >
              {error ? (
                <div className="mx-auto mb-1.5 w-full max-w-4xl rounded-xl border border-[rgba(242,109,109,0.2)] bg-[rgba(242,109,109,0.06)] px-3 py-2 text-xs font-medium text-[var(--vt-coral)] sm:mb-2 sm:text-[13px]">
                  {error}
                </div>
              ) : null}

              <AskComposer
                draft={draft}
                attachment={attachment}
                isSubmitting={isSubmitting}
                isDragActive={isDragActive}
                inputProps={getInputProps()}
                onDraftChange={setDraft}
                onSubmit={() => void submit()}
                onOpenPicker={openFilePicker}
                onClearAttachment={clearAttachment}
                onPreviewAttachment={openImagePreview}
              />

              <p className="relative z-10 mx-auto mt-1.5 max-w-md px-2 text-center text-[10px] leading-snug tracking-tight text-white/45 sm:mt-3 sm:text-xs sm:leading-relaxed sm:text-white/40">
                AI can make mistakes. This is not financial advice.
              </p>
            </div>
          </div>
        </div>
      </main>

      {activeImagePreview ? (
        <AskImageModal
          src={activeImagePreview.src}
          alt={activeImagePreview.alt}
          onClose={() => setActiveImagePreview(null)}
        />
      ) : null}

      <Modal
        open={deleteConfirm !== null}
        onClose={() => {
          if (!isDeletingSession) {
            setDeleteConfirm(null);
          }
        }}
        preventClose={isDeletingSession}
        title="Delete this chat?"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              disabled={isDeletingSession}
              onClick={() => setDeleteConfirm(null)}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeletingSession}
              onClick={() => void confirmDeleteSession()}
              className="rounded-xl bg-[var(--vt-coral)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(242,109,109,0.25)] transition hover:opacity-95 disabled:opacity-60"
            >
              {isDeletingSession ? "Deleting…" : "Delete"}
            </button>
          </div>
        }
      >
        {deleteConfirm ? (
          <p className="text-sm leading-relaxed text-white/55">
            <span className="font-medium text-white/80">&ldquo;{deleteConfirm.title}&rdquo;</span>{" "}
            and its messages will be removed permanently. This cannot be undone.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
