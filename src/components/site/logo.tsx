import { getAppName } from "@/lib/site-config";

type LogoSize = "default" | "compact" | "large" | "avatar";

interface LogoProps {
  large?: boolean;
  /** Smaller mark for dense mobile headers. */
  compact?: boolean;
  /** Explicit size (overrides `large` / `compact` when set). */
  size?: LogoSize;
  stacked?: boolean;
  /** Extra wordmark beside the mark (default off). */
  showWordmark?: boolean;
  /** @deprecated No-op — kept for backward compat. The image logo has no inner wordmark. */
  innerWordmark?: boolean;
}

/** Inline wordmark (e.g. verify.trading) — shared with hero. */
export function AppWordmarkInline({ className }: { className?: string }) {
  const name = getAppName();
  const dot = name.indexOf(".");
  if (dot === -1) {
    return <span className={className}>{name}</span>;
  }
  return (
    <span className={className}>
      {name.slice(0, dot)}
      <span className="text-[var(--vt-coral)]">.</span>
      {name.slice(dot + 1)}
    </span>
  );
}

export function Logo({
  large = false,
  compact = false,
  size: sizeProp,
  stacked = false,
  showWordmark = false,
}: LogoProps) {
  const size: LogoSize =
    sizeProp ?? (large ? "large" : compact ? "compact" : "default");
  const imgSize =
    size === "large"
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : size === "compact"
        ? "h-9 w-9"
        : size === "avatar"
          ? "h-8 w-8"
          : "h-11 w-11 sm:h-12 sm:w-12";
  const textSize = size === "large" ? "text-3xl" : "text-base";

  return (
    <div
      className={`flex items-center ${stacked ? "flex-col gap-3" : "gap-3"}`}
    >
      <img
        src="/logo.svg"
        alt="verify.trading"
        className={`${imgSize} shrink-0 ${
          size === "avatar"
            ? "drop-shadow-[0_4px_14px_rgba(76,110,245,0.28)]"
            : ""
        }`}
      />
      {showWordmark ? (
        <div className={`${textSize} font-black tracking-[-0.04em] text-white`}>
          <AppWordmarkInline />
        </div>
      ) : null}
    </div>
  );
}
