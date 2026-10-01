import { Caveat } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const hand = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

/** Hand-drawn curly arrow; points down at rest, rotate to aim it. */
function CurlyArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-16 w-10 shrink-0 lg:h-24 lg:w-16", className)}
    >
      <path d="M12 6C44 2 54 30 32 46C10 62 14 78 34 88" />
      <path d="M24 90L34 88L37 76" />
    </svg>
  );
}

/**
 * Handwritten margin note. Sits above/below the phone on narrow screens (flow)
 * and floats beside it from `lg` up, where there is side room. Place inside a
 * `relative` box the width of the phone.
 */
function GuideNote({
  children,
  className,
  arrowClassName,
  arrowFirst = false,
}: {
  children: ReactNode;
  className: string;
  arrowClassName?: string;
  arrowFirst?: boolean;
}) {
  return (
    <div
      className={cn(
        hand.className,
        "pointer-events-none flex flex-col items-center text-[1.5rem] leading-[1.05] text-[var(--vt-coral)] sm:text-[1.75rem] lg:absolute lg:w-60 lg:text-3xl xl:w-72 xl:text-4xl",
        className,
      )}
    >
      {arrowFirst ? <CurlyArrow className={arrowClassName} /> : null}
      <p className="text-center">{children}</p>
      {arrowFirst ? null : <CurlyArrow className={arrowClassName} />}
    </div>
  );
}

/** Above the phone on mobile; top-right of it on desktop. */
export function GuideNoteTop() {
  return (
    <GuideNote
      className="mb-5 lg:-top-2 lg:left-full lg:ml-4 lg:items-start xl:ml-8"
      arrowClassName="mt-1 rotate-[24deg] lg:-ml-1 lg:mt-2 lg:rotate-[62deg]"
    >
      click feature
      <br />
      to get started
    </GuideNote>
  );
}

/** Below the phone on mobile; bottom-left of it on desktop, arrow aimed at the footer. */
export function GuideNoteBottom() {
  return (
    <GuideNote
      className="mt-5 lg:bottom-0 lg:right-full lg:mr-4 lg:mt-0 lg:items-end xl:mr-8"
      arrowFirst={false}
      arrowClassName="mt-1 -scale-x-100"
    >
      Explore here
      <br />
      to learn more
    </GuideNote>
  );
}
