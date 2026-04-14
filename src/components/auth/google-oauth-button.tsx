import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="oauth"
      size="pill"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className="w-full gap-3"
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
    </Button>
  );
}
