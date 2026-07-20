"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const APPLY_URL = "https://verify-trading.getrewardful.com/signup";

export function AcceptanceForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueUrl = useMemo(() => {
    const url = new URL(APPLY_URL);
    if (name.trim()) {
      url.searchParams.set("name", name.trim());
    }
    if (email.trim()) {
      url.searchParams.set("email", email.trim());
    }
    if (accountEmail.trim()) {
      url.searchParams.set("account_email", accountEmail.trim());
    }
    url.searchParams.set("accepted_terms_version", "1.0");
    return url.toString();
  }, [accountEmail, email, name]);

  const canContinue = name.trim() && email.trim() && accepted;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/affiliates/terms-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name,
          email,
          accountEmail,
          termsVersion: "1.0",
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(body?.error || "Could not record acceptance. Please try again.");
        setIsSubmitting(false);
        return;
      }

      window.location.href = continueUrl;
    } catch {
      setError("Could not record acceptance. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--vt-blue)]/25 bg-white/[0.025] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] sm:p-7"
    >
      <h2 className="text-lg font-bold text-white">Confirm your acceptance</h2>
      <p className="mt-1 text-sm text-slate-400">
        Your details will be sent to the affiliate sign-up page with the terms
        version you accepted.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
            Full legal name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="John Smith"
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--vt-blue)]"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
            Email address
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--vt-blue)]"
            required
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
            verify.trading account email{" "}
            <span className="font-medium normal-case tracking-normal text-slate-500">
              (if different)
            </span>
          </span>
          <input
            type="email"
            value={accountEmail}
            onChange={(event) => setAccountEmail(event.target.value)}
            placeholder="Optional"
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--vt-blue)]"
          />
        </label>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--vt-blue)]/20 bg-[var(--vt-blue)]/10 p-4 text-sm leading-6 text-slate-200">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--vt-blue)]"
          required
        />
        <span>
          <strong className="text-white">
            I have read, understood, and agree to be bound by the
            verify.trading Affiliate Partner Programme Terms and Conditions
          </strong>{" "}
          (Version 1.0). I confirm I am aged 18 or over and authorised to enter
          into this agreement.
        </span>
      </label>

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--vt-coral)]/30 bg-[var(--vt-coral)]/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/affiliates"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!canContinue || isSubmitting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-6 text-sm font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isSubmitting ? "Recording acceptance..." : "Accept & Continue to Sign-up"}
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </form>
  );
}
