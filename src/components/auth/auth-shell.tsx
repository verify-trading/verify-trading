import type { ReactNode } from "react";

import { SiteNav } from "@/components/site/site-nav";

/** Centered spinner for auth Suspense / session checks (matches Ask route fallback). */
export function AuthShellSpinner() {
  return (
    <div
      className="flex min-h-44 flex-col items-center justify-center py-8"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="size-8 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-(--vt-blue)"
        aria-hidden
      />
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  leadingIcon,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional icon above the title (e.g. Mail / KeyRound for password flows). */
  leadingIcon?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--vt-navy)] text-white selection:bg-[var(--vt-blue)] selection:text-white">
      {/* 
        Professional background depth:
        A subtle engineering/chart grid that fades out at the edges,
        coupled with a faint, static dark-blue radial spotlight behind the form.
      */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[var(--vt-blue)] opacity-5 blur-[140px] rounded-full w-[800px] h-[800px]" />
        <div 
          className="absolute inset-0 opacity-[0.06]" 
          style={{ 
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 100%)'
          }} 
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <SiteNav />
        <main className="flex flex-1 flex-col justify-start px-4 pb-10 pt-8 sm:px-6 sm:pt-10 md:pt-12 lg:pt-14">
          <div className="relative mx-auto w-full max-w-sm sm:max-w-md">
            <div className="relative rounded-[24px] border border-[color:var(--vt-border)] bg-[var(--vt-card)] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5 sm:p-8 md:p-9">
              {leadingIcon ? (
                <div className="mb-5 flex justify-center" aria-hidden>
                  <div className="flex size-13 items-center justify-center rounded-2xl border border-white/8 bg-linear-to-b from-white/8 to-white/2 text-(--vt-blue) shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    {leadingIcon}
                  </div>
                </div>
              ) : null}
              <h1 className="text-center text-2xl font-black tracking-[-0.04em] sm:text-3xl sm:tracking-[-0.05em]">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 text-center text-[15px] font-medium leading-relaxed text-[var(--vt-muted)]">
                  {subtitle}
                </p>
              ) : null}
              <div className="mt-8 space-y-5">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
