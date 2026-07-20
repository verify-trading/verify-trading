import type { ReactNode } from "react";

/** Shared card surface token used across the landing sections. */
export const surface = "rounded-xl border border-white/[0.08] bg-white/[0.02]";

/** Small coral uppercase eyebrow label shown above section headings. */
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-coral)]/90">
      {children}
    </p>
  );
}
