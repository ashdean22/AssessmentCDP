"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SOURCES, STATUSES } from "@/lib/normalize";
import { CHURN_TIERS, TIER_LABEL } from "@/lib/score";
import { PAGE_SIZE, SORTS, type ListParams, type SortKey, type SubscriberRow } from "@/lib/subscribers-list";
import { AutoSelect } from "../auto-select";

const TIER_DOT: Record<string, string> = { active: "bg-emerald-500", cooling: "bg-amber-400", at_risk: "bg-coral", cold: "bg-neutral-400" };
const pill = "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-espresso dark:border-neutral-700 dark:bg-neutral-950";

function toQuery(p: ListParams) {
  const u = new URLSearchParams();
  (Object.keys(p) as (keyof ListParams)[]).forEach((k) => { const v = p[k]; if (v !== "" && !(k === "page" && v === 1) && !(k === "sort" && v === "last_open")) u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** Filters apply as you type (debounced); the URL stays shareable. */
export function SubscriberBrowser({ initial, initialRows, initialTotal }: { initial: ListParams; initialRows: SubscriberRow[]; initialTotal: number }) {
  const [p, setP] = useState<ListParams>(initial);
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);
  const seq = useRef(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await fetch(`/api/subscribers${toQuery(p)}`, { cache: "no-store" });
      if (my !== seq.current) return;
      if (r.ok) { const j = await r.json(); setRows(j.rows); setTotal(j.total); }
      setBusy(false);
      window.history.replaceState(null, "", `/subscribers${toQuery(p)}`);
    }, 150);
    return () => clearTimeout(t);
  }, [p]);

  const set = (patch: Partial<ListParams>) => setP((prev) => ({ ...prev, page: 1, ...patch }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = p.tier || p.status || p.source || p.q;

  return (
    <>
      <p className="mt-1 text-sm text-neutral-500">
        <span className={busy ? "opacity-50" : ""}>{total.toLocaleString()} readers{filtered ? " match" : ""}.</span> Filters apply as you type. Click an email to open the profile.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input value={p.q} onChange={(e) => set({ q: e.target.value })} placeholder="email starts with…" autoFocus className={`${pill} w-56`} />
        <AutoSelect value={p.tier} onChange={(e) => set({ tier: e.target.value })} className={pill}><option value="">Any tier</option>{CHURN_TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</AutoSelect>
        <AutoSelect value={p.status} onChange={(e) => set({ status: e.target.value })} className={pill}><option value="">Any status</option>{STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}</AutoSelect>
        <AutoSelect value={p.source} onChange={(e) => set({ source: e.target.value })} className={pill}><option value="">Any source</option>{SOURCES.map((t) => <option key={t} value={t}>{t}</option>)}</AutoSelect>
        <AutoSelect value={p.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} className={pill}>{(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}</AutoSelect>
        {filtered && <button type="button" onClick={() => set({ tier: "", status: "", source: "", q: "" })} className="text-sm text-neutral-500 hover:text-coral">clear</button>}
      </div>

      <div className={`mt-5 overflow-x-auto rounded-2xl border border-neutral-200 bg-white transition-opacity dark:border-neutral-800 dark:bg-neutral-950 ${busy ? "opacity-70" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>{["Email", "Tier", "Score", "Status", "Source", "Signed up", "Last open"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No readers match.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                <td className="px-4 py-2"><Link href={`/lookup?email=${encodeURIComponent(r.email)}`} className="font-medium hover:text-coral hover:underline">{r.email}</Link>{r.merged_count > 1 && <span className="ml-2 text-[10px] text-neutral-400">merged ×{r.merged_count}</span>}</td>
                <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${TIER_DOT[r.churn_tier ?? ""] ?? "bg-neutral-300"}`} />{r.churn_tier ? TIER_LABEL[r.churn_tier as keyof typeof TIER_LABEL] : "—"}</span></td>
                <td className="px-4 py-2 tabular-nums">{r.engagement_score ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{r.status}</td>
                <td className="px-4 py-2 capitalize">{r.source}</td>
                <td className="px-4 py-2 text-neutral-500">{r.signup_date ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{r.last_open_date ?? "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 text-sm text-neutral-500">
        <span>Page {p.page} of {pages}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={p.page <= 1} onClick={() => setP((x) => ({ ...x, page: x.page - 1 }))} className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800">← Prev</button>
          <button type="button" disabled={p.page >= pages} onClick={() => setP((x) => ({ ...x, page: x.page + 1 }))} className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800">Next →</button>
        </div>
      </div>
    </>
  );
}
