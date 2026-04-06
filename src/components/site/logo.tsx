import { brandGradient } from "@/lib/brand";
import { getAppName } from "@/lib/site-config";

interface LogoProps {
  large?: boolean;
  stacked?: boolean;
  /** Extra wordmark beside the mark (default off — label is inside the ring). */
  showWordmark?: boolean;
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
  stacked = false,
  showWordmark = false,
}: LogoProps) {
  const ringSize = large
    ? "h-28 w-28 sm:h-32 sm:w-32"
    : "h-11 w-11 sm:h-12 sm:w-12";
  const innerInset = large ? "inset-[3px]" : "inset-[2px]";
  const innerTextSize = large
    ? "text-[15px] sm:text-[17px]"
    : "text-[8px] sm:text-[9px]";
  const textSize = large ? "text-3xl" : "text-base";

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
          className={`absolute ${innerInset} z-10 flex items-center justify-center rounded-full border border-white/10 bg-[rgba(10,13,46,0.94)] text-center font-black leading-[1.05] tracking-[-0.06em] text-white ${innerTextSize}`}
        >
          <span>
            <WordmarkInner />
          </span>
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
