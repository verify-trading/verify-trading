import { GoogleIcon } from "@/components/auth/google-icon";

type Props = {
  label?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  /** e.g. "Continue with Google" vs "Sign up with Google" */
  variant?: "continue" | "signup";
};

export function GoogleOAuthButton({
  label,
  onClick,
  disabled,
  loading,
  variant = "continue",
}: Props) {
  const text =
    label ??
    (variant === "signup" ? "Sign up with Google" : "Continue with Google");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className="group relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-white bg-white px-4 py-3 text-[15px] font-bold text-slate-900 shadow-[0_8px_20px_-6px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_12px_24px_-6px_rgba(255,255,255,0.3)] active:scale-[0.98] active:translate-y-0 disabled:pointer-events-none disabled:opacity-55 sm:min-h-11"
    >
      {loading ? (
        <span
          className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
          aria-hidden
        />
      ) : (
        <GoogleIcon className="size-5 shrink-0" />
      )}
      <span>{loading ? "Redirecting…" : text}</span>
    </button>
  );
}
