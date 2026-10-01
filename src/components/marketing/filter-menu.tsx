"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type MenuOption = { label: string; href: string; active: boolean };

/**
 * Popover listbox built on <details>: works without JS (options are plain links, so URLs stay shareable);
 * JS adds close on outside click, Escape (focus returns to the trigger) and on pick.
 */
export function FilterMenu({ label, value, options, active, align = "left" }: {
  label: string;
  value: string;
  options: MenuOption[];
  active?: boolean;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onDown = (e: Event) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        close();
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={`${label}: ${value}`}
        className={cn(
          "flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border px-3 text-sm transition-colors [&::-webkit-details-marker]:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60",
          active
            ? "border-[var(--vt-blue)]/50 bg-[var(--vt-blue)]/15 text-white"
            : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white",
        )}
      >
        <span className="text-slate-500">{label}</span>
        <span className="max-w-[9rem] truncate font-medium">{value}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div
        role="listbox"
        aria-label={label}
        className={cn(
          "absolute z-30 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1138] p-1 shadow-2xl shadow-black/50",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {options.map((o) => (
          <Link
            key={o.label}
            href={o.href}
            role="option"
            aria-selected={o.active}
            scroll={false}
            onClick={() => ref.current?.removeAttribute("open")}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-blue)]/60",
              o.active ? "bg-white/[0.08] font-medium text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {o.label}
            {o.active ? <Check className="size-4 text-[var(--vt-coral)]" aria-hidden /> : null}
          </Link>
        ))}
      </div>
    </details>
  );
}
