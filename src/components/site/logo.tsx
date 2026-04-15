import { brandGradient } from "@/lib/brand";
import { getAppName } from "@/lib/site-config";

type LogoSize = "default" | "compact" | "large" | "avatar";

interface LogoProps {
  large?: boolean;
  /** Smaller mark for dense mobile headers. */
  compact?: boolean;
  /** Explicit size (overrides `large` / `compact` when set). */
  size?: LogoSize;
  stacked?: boolean;
  /** Extra wordmark beside the mark (default off — label is inside the ring). */
  showWordmark?: boolean;
  /** When false, only the gradient ring and inner disc show (no app name in the ring). */
  innerWordmark?: boolean;
}

function WordmarkInner() {
  const name = getAppName();
  const dot = name.indexOf(".");
  if (dot === -1) {
    return <span className="px-0.5">{name}</span>;
  }
  return (
    <>
      {name.slice(0, dot)}
      <span className="text-[var(--vt-coral)]">.</span>
      <br />
      {name.slice(dot + 1)}
    </>
  );
}

function WordmarkInline() {
  const name = getAppName();
  const dot = name.indexOf(".");
  if (dot === -1) {
    return <span>{name}</span>;
  }
  return (
    <>
      {name.slice(0, dot)}
      <span className="text-[var(--vt-coral)]">.</span>
      {name.slice(dot + 1)}
    </>
  );
}

export function Logo({
  large = false,
  compact = false,
  size: sizeProp,
  stacked = false,
  showWordmark = false,
  innerWordmark = true,
}: LogoProps) {
  const size: LogoSize =
    sizeProp ??
    (large ? "large" : compact ? "compact" : "default");
  const ringSize =
    size === "large"
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : size === "compact"
        ? "h-9 w-9"
        : size === "avatar"
          ? "h-8 w-8"
          : "h-11 w-11 sm:h-12 sm:w-12";
  const innerInset =
    size === "large"
      ? "inset-[3px]"
      : size === "compact" || size === "avatar"
        ? "inset-[1.5px]"
        : "inset-[2px]";
  const innerTextSize =
    size === "large"
      ? "text-[15px] sm:text-[17px]"
      : size === "compact" || size === "avatar"
        ? "text-[7px]"
        : "text-[8px] sm:text-[9px]";
  const textSize = size === "large" ? "text-3xl" : "text-base";

  return (
    <div
      className={`flex items-center ${stacked ? "flex-col gap-3" : "gap-3"}`}
    >
      <div className={`relative ${ringSize} shrink-0`}>
        <div
          className="absolute inset-0 rounded-full opacity-45 blur-md"
          style={{ backgroundImage: brandGradient }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ backgroundImage: brandGradient }}
        />
        <div
          className={`absolute ${innerInset} z-10 flex items-center justify-center rounded-full border border-white/10 bg-[rgba(10,13,46,0.94)] text-center font-black leading-[1.05] tracking-[-0.06em] text-white ${innerWordmark ? innerTextSize : ""}`}
        >
          {innerWordmark ? (
            <span>
              <WordmarkInner />
            </span>
          ) : null}
        </div>
      </div>
      {showWordmark ? (
        <div className={`${textSize} font-black tracking-[-0.04em] text-white`}>
          <WordmarkInline />
        </div>
      ) : null}
    </div>
  );
}
