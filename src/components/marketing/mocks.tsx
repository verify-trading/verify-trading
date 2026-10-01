import { CheckCircle2 } from "lucide-react";

import { PhoneMock } from "@/components/marketing/primitives";
import { ProHeader, ProScreenBody } from "@/components/landing/hero-ask-demo/pro-screens";
import type { DemoScreen } from "@/components/landing/hero-ask-demo/types";

/** A Pro app screen (sample data) inside a phone frame. Reuses the homepage demo screens read-only. */
export function ProPhone({ screen, caption }: { screen: Exclude<DemoScreen, "ask">; caption?: string }) {
  return (
    <PhoneMock caption={caption ?? "Sample screen with illustrative data."}>
      <ProHeader screen={screen} />
      <ProScreenBody screen={screen} />
    </PhoneMock>
  );
}

/** Illustrative entity card. The name and figures are made up and labelled as such. */
export function VerifyCardMock() {
  const rows = [
    ["Regulator", "Listed, with register reference"],
    ["Warning lists", "None found"],
    ["Source", "Regulator register"],
  ];
  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-[rgba(76,110,245,0.25)] bg-[var(--vt-card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--vt-muted)]">Broker check</p>
            <p className="mt-1 text-lg font-bold text-white">Example Markets Ltd</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--vt-green)]/40 bg-[var(--vt-green)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--vt-green)]">
            <CheckCircle2 className="size-3" aria-hidden /> Trusted
          </span>
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-400">Score</span>
            <span className="font-semibold text-white">7.7 / 10</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10">
            <div className="h-full w-[77%] rounded-full bg-[var(--vt-green)]" />
          </div>
        </div>
        <dl className="mt-5 divide-y divide-white/[0.07] text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-slate-400">{k}</dt>
              <dd className="text-right text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded-lg bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-400">
          Every verdict shows where it came from. A Caution only appears with a cited regulator or court action.
        </p>
      </div>
      <figcaption className="mt-4 text-center text-xs text-[var(--vt-muted)]">
        Illustrative example. Not a real record.
      </figcaption>
    </figure>
  );
}
