"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TIER_LABEL } from "@/lib/score";
import { BeehiivPush } from "../beehiiv-push";

type Row = { id: number; email: string; status: string; source: string; signup_date: string | null; last_open_date: string | null; engagement_score: number | null; churn_tier: string | null };
type Result = { kind: string; rows: Row[]; meta: { name?: string; filter?: unknown; description?: string } };

const btn = "rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

/**
 * Fetches the full table for a result_id from the server (behind login).
 * This is the only place emails appear — the browser, never the model.
 */
export function ResultTable({ resultId }: { resultId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/results/${resultId}`).then(async (r) => {
      if (!r.ok) { setErr("Couldn't load result"); return; }
      setData(await r.json());
    });
  }, [resultId]);

  if (err) return <div className="mt-2 text-red-600">{err}</div>;
  if (!data) return <div className="mt-2 text-neutral-400">Loading table…</div>;

  const name = data.meta.name ?? "AI segment";
  const save = async () => {
    const r = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter: data.meta.filter }) });
    setNotice(r.ok ? "Saved to Segments." : "Save failed.");
  };
  const exportCsv = async () => {
    const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, filter: data.meta.filter }) });
    if (!r.ok) { setNotice("Export failed."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = `${name.replace(/[^a-z0-9-_]+/gi, "-")}.csv`;
    a.click();
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{name}</span>
        <span className="text-neutral-400">{data.rows.length.toLocaleString()} readers · loaded by the browser, not the model</span>
        <button className={btn} onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} table</button>
        {data.meta.filter != null && <>
          <button className={btn} onClick={save}>Save segment</button>
          <button className={btn} onClick={exportCsv}>Export CSV</button>
          <BeehiivPush filter={data.meta.filter} name={name} className={btn} />
        </>}
        {notice && <span className="text-emerald-600">{notice}</span>}
      </div>
      {open && (
        <div className="mt-2 max-h-72 overflow-auto rounded border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-neutral-50 text-left uppercase text-neutral-500 dark:bg-neutral-900">
              <tr>{["Email", "Status", "Source", "Signed up", "Last open", "Score", "Tier"].map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.rows.slice(0, 200).map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-1"><Link className="hover:underline" href={`/lookup?email=${encodeURIComponent(r.email)}`}>{r.email}</Link></td>
                  <td className="px-2 py-1 capitalize">{r.status}</td>
                  <td className="px-2 py-1 capitalize">{r.source}</td>
                  <td className="px-2 py-1">{r.signup_date ?? "—"}</td>
                  <td className="px-2 py-1">{r.last_open_date ?? "never"}</td>
                  <td className="px-2 py-1 tabular-nums">{r.engagement_score ?? "—"}</td>
                  <td className="px-2 py-1">{r.churn_tier ? TIER_LABEL[r.churn_tier as keyof typeof TIER_LABEL] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 200 && <div className="px-2 py-1 text-neutral-500">Showing 200 of {data.rows.length}. Export CSV for all.</div>}
        </div>
      )}
    </div>
  );
}
