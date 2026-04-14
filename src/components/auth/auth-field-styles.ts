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

/** Inline validation / API error callout above auth forms */
export const authInlineErrorBannerClass =
  "rounded-2xl border border-red-500/30 bg-red-500/12 px-4 py-3.5 text-sm leading-relaxed text-red-100";

/** Success / confirmation strip (e.g. password reset confirmation on login) */
export const authInlineSuccessBannerClass =
  "rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3.5 text-sm leading-relaxed text-emerald-100";

/** Success row with leading icon (e.g. forgot-password “email sent”) */
export const authInlineSuccessBannerFlexClass =
  "flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3.5 text-sm leading-relaxed text-emerald-50/95";

/** Neutral info (e.g. signup “check your email”) */
export const authInlineInfoBannerClass =
  "rounded-2xl border border-(--vt-blue)/35 bg-(--vt-blue)/10 px-4 py-3.5 text-sm leading-relaxed text-white/90";

export const authSecondaryLinkClass =
  "font-medium text-white/60 underline-offset-4 transition-all duration-200 hover:text-white hover:underline hover:decoration-white/50";
