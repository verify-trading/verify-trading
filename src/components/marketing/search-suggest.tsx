"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { cn } from "@/lib/utils";

type Suggestion = { n: string; s: string; v: string };
type EntityKind = "broker" | "propfirm" | "guru";

const MAX_SHOWN = 8;

/** Prefix matches first (what autocomplete users expect), then word-start, then substring. */
function rank(list: Suggestion[], q: string): Suggestion[] {
  const needle = q.toLowerCase();
  const prefix: Suggestion[] = [];
  const word: Suggestion[] = [];
  const sub: Suggestion[] = [];
  for (const item of list) {
    const name = item.n.toLowerCase();
    const at = name.indexOf(needle);
    if (at === -1) continue;
    if (at === 0) prefix.push(item);
    else if (name[at - 1] === " ") word.push(item);
    else sub.push(item);
    if (prefix.length >= MAX_SHOWN) break;
  }
  return [...prefix, ...word, ...sub].slice(0, MAX_SHOWN);
}

function Highlight({ name, q }: { name: string; q: string }) {
  const at = name.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <strong className="font-semibold text-white">{name.slice(at, at + q.length)}</strong>
      {name.slice(at + q.length)}
    </>
  );
}

/**
 * Google-style autocomplete for the register search box. The name list is
 * fetched once per page view, on first focus, from /api/compare/suggest
 * (CDN-cached); filtering is then instant and local. The component only
 * replaces the <input> inside the existing GET form, so search still works
 * exactly as before without JavaScript.
 */
export function SearchSuggest({
  type,
  path,
  plural,
  defaultValue,
  placeholder,
}: {
  type: EntityKind;
  path: string;
  plural: string;
  defaultValue?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [names, setNames] = useState<Suggestion[] | null>(null);
  const fetched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = () => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`/api/compare/suggest?type=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Suggestion[] | null) => {
        if (Array.isArray(data)) setNames(data);
      })
      .catch(() => {
        // Without the list the box degrades to the plain form search.
        fetched.current = false;
      });
  };

  const matches = useMemo(() => (names && q.trim().length >= 1 ? rank(names, q.trim()) : []), [names, q]);
  const show = open && matches.length > 0;

  // Close when focus or clicks land outside the combobox.
  useEffect(() => {
    if (!show) return;
    const onDown = (ev: PointerEvent) => {
      if (rootRef.current && ev.target instanceof Node && !rootRef.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [show]);

  const go = (s: Suggestion) => {
    setOpen(false);
    router.push(`${path}/${s.s}`);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (!show) {
      if (ev.key === "ArrowDown") setOpen(true);
      return;
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (ev.key === "Enter" && active >= 0 && matches[active]) {
      ev.preventDefault();
      go(matches[active]);
    } else if (ev.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
      <input
        id="compare-q"
        name="q"
        type="search"
        value={q}
        onChange={(ev) => {
          setQ(ev.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          load();
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls="compare-suggest"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `compare-suggest-${active}` : undefined}
        className="h-10 w-full rounded-lg border border-white/10 bg-black/20 pl-9 pr-20 text-sm text-white placeholder:text-slate-500 focus:border-[var(--vt-blue)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--vt-blue)]/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {show ? (
        <ul
          id="compare-suggest"
          role="listbox"
          aria-label={`Matching ${plural}`}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-white/12 bg-[#0c1035] py-1 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
        >
          {matches.map((s, i) => (
            <li key={s.s} role="option" id={`compare-suggest-${i}`} aria-selected={i === active}>
              {/* pointerdown beats the input's blur, so the tap always lands. */}
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={(ev) => {
                  ev.preventDefault();
                  go(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm text-slate-300",
                  i === active && "bg-white/[0.07] text-white",
                )}
              >
                <span className="truncate">
                  <Highlight name={s.n} q={q.trim()} />
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                  {s.v}
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
