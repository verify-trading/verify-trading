/** Shared classes: min height for touch, 16px+ text on small screens to avoid iOS input zoom */
export const authFieldClass =
  "min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition-all duration-300 placeholder:text-white/40 focus:border-[var(--vt-blue)] focus:bg-white/10 focus:ring-4 focus:ring-[var(--vt-blue)]/20 sm:min-h-11 sm:text-sm hover:border-white/20 hover:bg-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]";

export const authFieldErrorClass =
  "border-red-400/60 bg-red-400/10 focus:border-red-400 group-hover:border-red-400/80 focus:ring-red-500/30 aria-invalid:border-red-400/60";

/** Border + focus ring when the field has a validation error */
export function authFieldClassWithError(hasError: boolean) {
  return [authFieldClass, hasError ? authFieldErrorClass : ""].filter(Boolean).join(" ");
}

export const authLabelClass = "mb-2 block text-[13px] font-medium tracking-wide text-white/80";

export const authPrimaryButtonClass =
  "group relative flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--vt-coral)] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-6px_rgba(242,109,109,0.45)] transition-all duration-300 hover:brightness-105 hover:shadow-[0_16px_32px_-6px_rgba(242,109,109,0.6)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 disabled:pointer-events-none disabled:opacity-55 sm:min-h-11";

export const authSecondaryLinkClass =
  "font-medium text-white/60 underline-offset-4 transition-all duration-200 hover:text-white hover:underline hover:decoration-white/50";
