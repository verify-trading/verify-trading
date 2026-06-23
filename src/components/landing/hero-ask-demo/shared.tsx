"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { memo, useEffect, useRef } from "react";
import { ArrowUp, ArrowUpRight, ImageIcon } from "lucide-react";

import { brandGradient } from "@/lib/brand";
import { getAppName } from "@/lib/site-config";
import { cn } from "@/lib/utils";

import { DemoAnswerCard } from "./demo-cards";
import { DEMO_EXCHANGES, DEMO_SUGGESTIONS, type DemoExchange } from "./types";
import type { DemoState } from "./use-ask-demo-sequence";

/** Props every visual variant receives from the `HeroAskDemo` container. */
export type VariantViewProps = {
  state: DemoState;
  onActivate: () => void;
  /** Whether the in-screen subscription CTA is open. */
  ctaOpen: boolean;
  /** Dismiss the in-screen subscription CTA. */
  onCloseCta: () => void;
};

// Buttery spring for message enter/exit — a soft, well-damped bounce (not snappy).
const MESSAGE_TRANSITION = {
  type: "spring",
  bounce: 0.28,
  duration: 0.62,
} as const;

/** Resolved once at module load — avoids an env read on every render tick. */
const APP_NAME = getAppName();

const RING_MASK: CSSProperties = {
  mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
  WebkitMask:
    "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))",
};

/** Compact version of the real Ask empty-state logo ring (rippling fire energy). */
function DemoLogoRing({ className = "" }: { className?: string }) {
  return (
    <div className={cn("relative size-11", className)} aria-hidden>
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full motion-safe:animate-[ask-logo-ring-echo_1.05s_ease-out_infinite] motion-reduce:animate-none"
            style={{
              ...RING_MASK,
              backgroundImage: brandGradient,
              transformOrigin: "center",
              animationDelay: `${i * 0.26}s`,
            }}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute -inset-2 rounded-full blur-xl motion-safe:animate-[ask-logo-ring-glow_3.2s_ease-in-out_infinite] motion-reduce:opacity-50"
        style={{ backgroundImage: brandGradient }}
      />
      <div className="absolute inset-0">
        <div
          className="size-full rounded-full"
          style={{ ...RING_MASK, backgroundImage: brandGradient }}
        />
      </div>
      <div className="absolute inset-[3px] rounded-full border border-white/10 bg-[rgba(10,13,46,0.94)] shadow-[inset_0_0_12px_rgba(0,0,0,0.45)]" />
    </div>
  );
}

/** Clean app mark — no drop-shadow glow (the logo already has its own ring). */
export function BrandMark({
  size = 30,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
    />
  );
}

function AssistantAvatar() {
  return <BrandMark size={26} className="mt-0.5" />;
}

/** iOS-style status-bar signal bars (shared by the phone variants). */
export function SignalBars() {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden>
      {[3, 5, 7, 9].map((h) => (
        <span
          key={h}
          className="w-[3px] rounded-[1px] bg-white/85"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

/** iOS-style status-bar battery (shared by the phone variants). */
export function Battery({ level = 72 }: { level?: number }) {
  return (
    <div className="flex items-center gap-[2px]" aria-hidden>
      <div className="relative h-[11px] w-[22px] rounded-[3px] border border-white/50 p-[1.5px]">
        <div
          className="h-full rounded-[1px] bg-white/85"
          style={{ width: `${level}%` }}
        />
      </div>
      <span className="h-[4px] w-[1.5px] rounded-full bg-white/50" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: "linear-gradient(135deg, var(--vt-coral), #BE185D)" }}
      aria-hidden
    >
      U
    </div>
  );
}

/** 3-bar asterisk glyph, matching the real Ask "working" indicator. */
function WorkingGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {[0, 60, -60].map((deg) => (
        <rect
          key={deg}
          x="11"
          y="3"
          width="2"
          height="18"
          rx="1"
          fill="currentColor"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function SpeakerLabel({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      <span className="text-[10px] font-semibold text-white/40">{label}</span>
    </div>
  );
}

// Memoized — props (a static string / module-constant exchange / stable
// onActivate) never change while the *next* question types, so these rows skip
// re-rendering ~15-30×/s during a typing beat.
const UserBubble = memo(function UserBubble({ question }: { question: string }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="flex min-w-0 flex-col items-end">
        <SpeakerLabel label="You" align="right" />
        <div className="mt-1 max-w-[85%] rounded-[14px_14px_4px_14px] bg-[var(--vt-coral)] px-3 py-2 text-left text-[13px] leading-relaxed text-white shadow-[0_8px_28px_rgba(242,109,109,0.18)]">
          {question}
        </div>
      </div>
      <UserAvatar />
    </div>
  );
});

const ThinkingContent = memo(function ThinkingContent({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <SpeakerLabel label={APP_NAME} />
        <div className="mt-1.5 flex items-center gap-2">
          <WorkingGlyph className="size-4 shrink-0 text-[var(--vt-blue)] motion-safe:animate-spin motion-safe:[animation-duration:2.4s]" />
          {/* Crossfade each status phrase so the "thinking" reads as live work. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="text-[13px] font-medium text-[var(--vt-blue)]"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

const AnswerContent = memo(function AnswerContent({
  exchange,
  onActivate,
}: {
  exchange: DemoExchange;
  onActivate: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <SpeakerLabel label={APP_NAME} />
        <div className="mt-1.5">
          <DemoAnswerCard card={exchange.card} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exchange.followups.map((q) => (
              <button
                key={q}
                type="button"
                onClick={onActivate}
                className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-left text-[11px] font-medium text-white/65 transition-colors hover:border-[rgba(76,110,245,0.35)] hover:bg-[rgba(76,110,245,0.08)] hover:text-white"
              >
                <ArrowUpRight className="size-3 shrink-0 text-white/35 group-hover:text-[var(--vt-blue)]" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

function IntroBlock({
  state,
  onActivate,
}: {
  state: DemoState;
  onActivate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-5 text-center">
      <DemoLogoRing />
      <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-white">
        What can I help with?
      </h3>
      <p className="mx-auto mt-1.5 max-w-[15rem] text-[12px] leading-snug text-white/50">
        Brokers, markets, sizing &amp; charts. Ask in plain English.
      </p>
      <div className="mt-4 grid w-full max-w-xs grid-cols-1 gap-2">
        {DEMO_SUGGESTIONS.slice(0, 3).map((prompt, i) => (
          <motion.button
            key={prompt}
            type="button"
            onClick={onActivate}
            animate={
              state.activeSuggestion === i ? { scale: 0.97 } : { scale: 1 }
            }
            transition={{ duration: 0.18 }}
            className={cn(
              "rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[12px] font-medium leading-snug text-white/85 ring-1 ring-white/[0.03] transition-colors",
              "hover:border-[rgba(76,110,245,0.35)] hover:bg-[rgba(76,110,245,0.08)] hover:text-white",
              state.activeSuggestion === i &&
                "border-[rgba(76,110,245,0.45)] bg-[rgba(76,110,245,0.12)] text-white",
            )}
          >
            {prompt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function exchangeForQuestion(question: string): DemoExchange | undefined {
  return DEMO_EXCHANGES.find((e) => e.question === question);
}

type ThreadItem = { key: string; node: ReactNode; intro?: boolean };

/**
 * The scrollable conversation viewport shared by every variant. Uses framer-motion
 * AnimatePresence so each message smoothly enters/exits and the layout reflows.
 */
export function DemoThread({
  state,
  onActivate,
  className,
}: {
  state: DemoState;
  onActivate: () => void;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingExchange = state.pendingQuestion
    ? exchangeForQuestion(state.pendingQuestion)
    : undefined;
  const isIntro =
    state.showIntro && state.thread.length === 0 && !pendingExchange;

  const items: ThreadItem[] = [];
  if (isIntro) {
    items.push({
      key: "intro",
      intro: true,
      node: <IntroBlock state={state} onActivate={onActivate} />,
    });
  } else {
    for (const ex of state.thread) {
      items.push({ key: `${ex.id}-q`, node: <UserBubble question={ex.question} /> });
      items.push({
        key: `${ex.id}-a`,
        node: <AnswerContent exchange={ex} onActivate={onActivate} />,
      });
    }
    if (pendingExchange) {
      items.push({
        key: `${pendingExchange.id}-q`,
        node: <UserBubble question={pendingExchange.question} />,
      });
      if (state.thinking) {
        items.push({
          key: `${pendingExchange.id}-think`,
          node: <ThinkingContent label={state.thinkingLabel} />,
        });
      }
    }
  }

  // Keep the latest beat in view as cards reveal (after layout settles).
  const scrollKey = items.map((i) => i.key).join("|");
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return; // nothing to scroll
    const toBottom = () =>
      el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    toBottom();
    const t = window.setTimeout(toBottom, 460);
    return () => window.clearTimeout(t);
  }, [scrollKey, reduced]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "ask-scrollbar relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 py-3",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((it) => (
          <motion.div
            key={it.key}
            layout="position"
            className={it.intro ? "m-auto w-full" : undefined}
            initial={
              reduced
                ? false
                : it.intro
                  ? { opacity: 0, scale: 0.97 }
                  : { opacity: 0, y: 20, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
            transition={reduced ? { duration: 0 } : MESSAGE_TRANSITION}
          >
            {it.node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Static composer — a calm "Ask anything…" field. The conversation plays itself
 * in the thread; this just invites the visitor. Any focus / keypress / submit
 * fires `onActivate` (opens the CTA); readOnly so no mobile keyboard appears.
 */
export function DemoComposer({
  onActivate,
  className,
  inputClassName,
  sendClassName,
  placeholder = "Ask anything…",
}: {
  onActivate: () => void;
  className?: string;
  inputClassName?: string;
  sendClassName?: string;
  placeholder?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onActivate();
      }}
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(17,22,72,0.88)] px-2 py-1.5 backdrop-blur-xl",
        "transition-shadow focus-within:shadow-[0_0_0_3px_rgba(76,110,245,0.14)]",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center text-white/35">
        <ImageIcon className="size-4" aria-hidden />
      </span>
      <input
        type="text"
        readOnly
        aria-label="Ask anything"
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 cursor-text bg-transparent text-[13px] text-white caret-transparent outline-none placeholder:text-white/40",
          inputClassName,
        )}
        onFocus={onActivate}
        onKeyDown={onActivate}
      />
      <motion.button
        type="submit"
        aria-label="Send"
        onClick={onActivate}
        whileTap={reduced ? undefined : { scale: 0.9 }}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--vt-blue)] text-white shadow-[0_4px_16px_rgba(76,110,245,0.35)] transition hover:brightness-110",
          sendClassName,
        )}
      >
        <ArrowUp className="size-3.5" aria-hidden />
      </motion.button>
    </form>
  );
}
