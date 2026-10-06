"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUGGEST_MIN_CHARS } from "@/lib/search";
import { TIER_LABEL } from "@/lib/score";

type S = { email: string; status: string; churn_tier: string | null };

/** Search box with debounced prefix suggestions. Enter or click to open a profile. */
export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<S[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < SUGGEST_MIN_CHARS) { setItems([]); return; }
      const r = await fetch(`/api/subscribers/suggest?q=${encodeURIComponent(term)}`);
      if (!r.ok || my !== seq.current) return;
      const j = await r.json();
      setItems(j.suggestions ?? []); setActive(-1); setOpen(true);
    }, term.length < SUGGEST_MIN_CHARS ? 0 : 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (email: string) => { setOpen(false); router.push(`/lookup?email=${encodeURIComponent(email)}`); };

  return (
    <form className="relative mt-6 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); go(active >= 0 ? items[active].email : q); }}>
      <div className="relative flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="start typing an email…"
          autoFocus
          autoComplete="off"
          aria-autocomplete="list"
          className="w-full rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-espresso dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-200"
        />
        {open && items.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
            {items.map((s, i) => (
              <li key={s.email} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(s.email)} onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? "bg-neutral-100 dark:bg-neutral-900" : ""}`}>
                  <span className="min-w-0 flex-1 truncate">{s.email}</span>
                  <span className="text-[11px] capitalize text-neutral-500">{s.status}</span>
                  <span className="text-[11px] text-neutral-400">{s.churn_tier ? TIER_LABEL[s.churn_tier as keyof typeof TIER_LABEL] : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="rounded-full bg-espresso px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">Search</button>
    </form>
  );
}
