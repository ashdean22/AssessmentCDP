"use client";

import { useState } from "react";
import type { Filter } from "@/lib/segments/fields";
import type { WinbackStats } from "@/lib/winback";
import { BeehiivPush } from "./beehiiv-push";
import { Info } from "./info";

const btn = "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
const ghost = "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

type Draft = { draft: string; stats: WinbackStats; ran: string; model: string };

/**
 * "Reach out before they're gone": one click saves the at-risk segment, the
 * AI drafts a win-back email from aggregates only, then copy or push (mock).
 */
export function WinBack({ count, filter, name }: { count: number; filter: Filter; name: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const r = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter }) });
    setNotice(r.ok ? `Saved “${name}” to Segments.` : "Save failed.");
  };
  const write = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/winback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Draft failed"); return; }
    setDraft(j);
  };
  const copy = () => { navigator.clipboard?.writeText(draft?.draft ?? ""); setNotice("Copied."); };

  return (
    <section className="rounded-xl border border-coral/40 bg-coral-soft/40 p-5 dark:border-coral/40 dark:bg-coral/10">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">Reach out before they&apos;re gone <Info text="At-risk readers are cooling but not gone. Save them as a segment in one click, let the AI draft a win-back email from aggregate stats only (it never sees who they are), then copy it or push the list to beehiiv (mock)." /></h2>
          <div className="mt-1 text-sm"><b className="text-2xl font-semibold tabular-nums">{count.toLocaleString()}</b> readers are <b>At risk</b> (score 15 to 39).</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className={btn} onClick={save}>Save as segment</button>
          <button className={btn} onClick={write} disabled={busy || count === 0}>{busy ? "Drafting…" : "Draft win-back email"}</button>
          <BeehiivPush filter={filter} name={name} className={btn} />
        </div>
        {notice && <span className="basis-full text-xs text-emerald-700">{notice}</span>}
        {err && <span className="basis-full text-xs text-red-600">{err}</span>}
      </div>
      {draft && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
              <span>Draft from {draft.model}</span>
              <button className={`${ghost} ml-auto`} onClick={copy}>Copy</button>
              <button className={ghost} onClick={write} disabled={busy}>Redraft</button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{draft.draft}</pre>
          </div>
          <details className="rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950" open>
            <summary className="cursor-pointer font-medium text-neutral-600 dark:text-neutral-300">What the AI saw (aggregates only)</summary>
            <div className="mt-1 text-neutral-500">ran: {draft.ran}</div>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-neutral-50 p-2 dark:bg-neutral-900">{JSON.stringify(draft.stats, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
