import type { Verdict } from "@/lib/compare/entities";
import { verdictTone } from "@/lib/compare/entities";
import { cn } from "@/lib/utils";

const toneClass = {
  green: "border-[var(--vt-green)]/40 bg-[var(--vt-green)]/10 text-[var(--vt-green)]",
  amber: "border-[var(--vt-amber)]/40 bg-[var(--vt-amber)]/10 text-[var(--vt-amber)]",
  coral: "border-[var(--vt-coral)]/40 bg-[var(--vt-coral)]/10 text-[var(--vt-coral)]",
  slate: "border-white/15 bg-white/5 text-slate-300",
} as const;

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        toneClass[verdictTone(verdict)],
        className,
      )}
    >
      {verdict}
    </span>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatRecordDate(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? dateFmt.format(new Date(t)) : "Not recorded";
}

export const askCheckHref = (name: string) => `/ask?prefill=${encodeURIComponent(`Is ${name} safe?`)}`;

export function scoreLabel(e: { score: number | null; provisional: boolean }): string {
  if (e.provisional) return "Provisional";
  return e.score === null ? "Not yet rated" : `${e.score.toFixed(1)} / 10`;
}

const barClass = {
  green: "bg-[var(--vt-green)]",
  amber: "bg-[var(--vt-amber)]",
  coral: "bg-[var(--vt-coral)]",
  slate: "bg-slate-500",
} as const;

/** Initial avatar tinted by verdict band. Decorative: the name is always next to it. */
export function EntityAvatar({ name, verdict, className }: { name: string; verdict: Verdict; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold uppercase",
        toneClass[verdictTone(verdict)],
        className,
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** Score out of 10 with a thin bar. Unrated and provisional records show a text label and an empty track. */
export function ScoreBar({ entity, className }: { entity: { score: number | null; provisional: boolean; verdict: Verdict }; className?: string }) {
  const { score } = entity;
  return (
    <div className={cn("min-w-0", className)}>
      {score === null ? (
        <span className="text-xs text-slate-400">{scoreLabel(entity)}</span>
      ) : (
        <span className="font-mono text-sm font-semibold text-white">
          {score.toFixed(1)}
          <span className="text-xs font-normal text-slate-500"> / 10</span>
        </span>
      )}
      <div className="mt-1.5 h-1 w-full max-w-[6.5rem] overflow-hidden rounded-full bg-white/10" aria-hidden>
        {score === null ? null : (
          <div className={cn("h-full rounded-full", barClass[verdictTone(entity.verdict)])} style={{ width: `${Math.max(0, Math.min(10, score)) * 10}%` }} />
        )}
      </div>
    </div>
  );
}
