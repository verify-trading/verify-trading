"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { SectionEyebrow, surface } from "./section-primitives";
import { HOMEPAGE_FAQS } from "@/lib/landing/faq";
import { cn } from "@/lib/utils";

/* ─── FAQ ─── */

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <SectionEyebrow>FAQ</SectionEyebrow>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">Common Questions</h2>
      </div>

      <div className="mt-10 space-y-2">
        {HOMEPAGE_FAQS.map((f, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={f.q} className={cn(surface, "overflow-hidden")}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vt-blue)]/50"
                aria-expanded={isOpen}
              >
                <span className="text-[15px] font-semibold leading-snug text-white">{f.q}</span>
                <ChevronDown
                  className={cn(
                    "mt-0.5 size-5 shrink-0 text-[var(--vt-blue)] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="border-t border-white/[0.06] px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-400">
                    {f.a}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
