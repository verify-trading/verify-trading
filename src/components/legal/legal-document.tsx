import Link from "next/link";

import { getAppName } from "@/lib/site-config";

type LegalSection = {
  /** Anchor for in-page links (e.g. `privacy` for `/terms#privacy`). */
  id?: string;
  title: string;
  paragraphs: string[];
};

export function LegalDocument({
  eyebrow,
  title,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  const app = getAppName();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--vt-muted)] transition hover:text-white"
      >
        ← Home
      </Link>

      <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-blue)]">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-[var(--vt-muted)]">{app}</p>

      <p className="mt-8 text-base leading-relaxed text-slate-300">{summary}</p>

      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.id ?? section.title} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <div className="mt-4 space-y-4">
              {section.paragraphs.map((paragraph, pi) => (
                <p key={`${section.title}-${pi}`} className="text-sm leading-relaxed text-slate-300 sm:text-base sm:leading-7">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-16 border-t border-white/10 pt-8 text-center text-xs leading-relaxed text-[var(--vt-muted)]">
        This text is for transparency and is not legal or financial advice. Have it reviewed for your jurisdiction before
        launch.
      </p>
    </main>
  );
}
