"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FIELD_META, type Filter, type Group, type Rule } from "@/lib/segments/fields";
import { SOURCES, STATUSES } from "@/lib/normalize";
import { APP_EVENT_TYPES } from "@/lib/config";
import { CHURN_TIERS, TIER_LABEL } from "@/lib/score";

type Node = Rule | Group;
const isGroup = (n: Node): n is Group => (n as Group).op !== undefined;

type Row = {
  id: number; email: string; status: string; source: string; signup_date: string | null;
  last_open_date: string | null; engagement_score: number | null; churn_tier: string | null;
};
type Saved = { id: number; name: string; filter_json: Filter; created_at: string };

const FIELDS = Object.keys(FIELD_META) as Rule["field"][];

/** Sensible starting rule for each field (and when the comparison changes). */
function defaultRule(field: Rule["field"], cmp?: string): Rule {
  switch (field) {
    case "source": return cmp === "in" ? { field, cmp: "in", value: ["instagram"] } : { field, cmp: (cmp as "is" | "is_not") ?? "is", value: "instagram" };
    case "status": return { field, cmp: (cmp as "is" | "is_not") ?? "is", value: "active" };
    case "signup_date": return cmp === "in_last_days" || !cmp ? { field, cmp: "in_last_days", value: 30 } : { field, cmp: cmp as "before" | "after", value: "2026-09-01" };
    case "days_since_open":
      if (cmp === "never") return { field, cmp: "never" };
      if (cmp === "between") return { field, cmp: "between", value: [31, 60] };
      return { field, cmp: (cmp as "gt" | "lt") ?? "gt", value: 30 };
    case "visited_page": return cmp === "at_least" ? { field, cmp: "at_least", value: "/subscribe", times: 2 } : { field, cmp: (cmp as "has" | "has_not") ?? "has", value: "/subscribe" };
    case "utm_source": return cmp === "in" ? { field, cmp: "in", value: ["instagram"] } : { field, cmp: "is", value: "instagram" };
    case "web_visits": return { field, cmp: (cmp as "gt" | "lt") ?? "gt", value: 5, days: 30 };
    case "has_app": return { field, cmp: (cmp as "yes" | "no") ?? "yes" };
    case "app_events": return { field, cmp: (cmp as "gt" | "lt") ?? "gt", value: 3, days: 30, event: "read_story" };
    case "last_app_activity": return { field, cmp: (cmp as "within" | "older_than") ?? "older_than", value: 14 };
    case "engagement_score": return cmp === "between" ? { field, cmp: "between", value: [40, 69] } : { field, cmp: (cmp as "gt" | "lt") ?? "gt", value: 70 };
    case "churn_tier": return { field, cmp: (cmp as "is" | "is_not") ?? "is", value: "at_risk" };
  }
}

const inputCls = "rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200";
const btnCls = "rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";
const primaryBtn = "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

export function SegmentBuilder({
  initialName, initialFilter, savedSegments, knownPages,
}: { initialName: string; initialFilter: Filter; savedSegments: Saved[]; knownPages: string[] }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [name, setName] = useState(initialName);
  const [count, setCount] = useState<number | null>(null);
  const [description, setDescription] = useState<string>("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved[]>(savedSegments);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  // Live count, debounced
  useEffect(() => {
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const res = await fetch("/api/segments/count", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter }) });
      const j = await res.json();
      if (my !== seq.current) return;
      if (!res.ok) { setError(j.error === "invalid filter" ? "Finish filling in every rule." : j.error); setCount(null); return; }
      setError(null); setCount(j.count); setDescription(j.description); setRows(null);
    }, 350);
    return () => clearTimeout(t);
  }, [filter]);

  const preview = useCallback(async () => {
    setBusy(true);
    const res = await fetch("/api/segments/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter, limit: 200 }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error); return; }
    setRows(j.rows);
  }, [filter]);

  const save = async () => {
    const n = name.trim() || description.slice(0, 80);
    setBusy(true);
    const res = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n, filter }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error); return; }
    setSaved([j.segment, ...saved]); setName(n); setNotice(`Saved "${n}".`);
  };

  const remove = async (id: number) => {
    await fetch(`/api/segments?id=${id}`, { method: "DELETE" });
    setSaved(saved.filter((s) => s.id !== id));
  };

  const exportCsv = async () => {
    setBusy(true);
    const res = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter, name: name || "segment" }) });
    setBusy(false);
    if (!res.ok) { setError("Export failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(name || "segment").replace(/[^a-z0-9-_]+/gi, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const json = useMemo(() => JSON.stringify(filter, null, 2), [filter]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <GroupEditor group={filter} onChange={(g) => setFilter(g)} knownPages={knownPages} root />

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{count === null ? "…" : count.toLocaleString()}</div>
            <div className="text-xs text-neutral-500">matching subscribers</div>
          </div>
          <div className="min-w-0 flex-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error ? <span className="text-red-600">{error}</span> : <><span className="text-neutral-400">ran: </span>{description}</>}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Segment name" className={`${inputCls} w-44`} />
          <button className={primaryBtn} onClick={preview} disabled={busy || !!error}>Show table</button>
          <button className={primaryBtn} onClick={save} disabled={busy || !!error}>Save</button>
          <button className={primaryBtn} onClick={exportCsv} disabled={busy || !!error}>Export CSV</button>
          <button className={`${primaryBtn} opacity-60`} title="Mock arrives Oct 16" disabled>Push to beehiiv</button>
          {notice && <span className="text-xs text-emerald-600">{notice}</span>}
        </div>

        {rows && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
                <tr>{["Email", "Status", "Source", "Signed up", "Last open", "Score", "Tier"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-1.5"><Link className="hover:underline" href={`/lookup?email=${encodeURIComponent(r.email)}`}>{r.email}</Link></td>
                    <td className="px-3 py-1.5 capitalize">{r.status}</td>
                    <td className="px-3 py-1.5 capitalize">{r.source}</td>
                    <td className="px-3 py-1.5">{r.signup_date ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.last_open_date ?? "never"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.engagement_score ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.churn_tier ? TIER_LABEL[r.churn_tier as keyof typeof TIER_LABEL] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {count !== null && rows.length < count && (
              <div className="px-3 py-2 text-xs text-neutral-500">Showing {rows.length} of {count.toLocaleString()}. Export CSV for the full list (up to 5,000).</div>
            )}
          </div>
        )}

        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Filter JSON (what the AI and the UI both send to the compiler)</summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-100 p-3 dark:bg-neutral-900">{json}</pre>
        </details>
      </div>

      <aside className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Saved segments</h2>
        {saved.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => { setFilter(s.filter_json); setName(s.name); setRows(null); }}>{s.name}</button>
                <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => remove(s.id)}>delete</button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------- editors

function GroupEditor({ group, onChange, knownPages, root = false }: { group: Group; onChange: (g: Group) => void; knownPages: string[]; root?: boolean }) {
  const update = (i: number, n: Node) => onChange({ ...group, rules: group.rules.map((r, j) => (j === i ? n : r)) });
  const remove = (i: number) => onChange({ ...group, rules: group.rules.filter((_, j) => j !== i) });
  return (
    <div className={`rounded-xl border p-3 ${root ? "border-neutral-200 dark:border-neutral-800" : "border-dashed border-neutral-300 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-900/40"}`}>
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-neutral-500">Match</span>
        <select value={group.op} onChange={(e) => onChange({ ...group, op: e.target.value as "AND" | "OR" })} className={inputCls}>
          <option value="AND">ALL (AND)</option>
          <option value="OR">ANY (OR)</option>
        </select>
        <span className="text-neutral-500">of the following</span>
      </div>
      <div className="space-y-2">
        {group.rules.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              {isGroup(r)
                ? <GroupEditor group={r} onChange={(g) => update(i, g)} knownPages={knownPages} />
                : <RuleEditor rule={r} onChange={(n) => update(i, n)} knownPages={knownPages} />}
            </div>
            <button className="mt-1 text-neutral-400 hover:text-red-600" onClick={() => remove(i)} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className={btnCls} onClick={() => onChange({ ...group, rules: [...group.rules, defaultRule("source")] })}>+ Rule</button>
        <button className={btnCls} onClick={() => onChange({ ...group, rules: [...group.rules, { op: group.op === "AND" ? "OR" : "AND", rules: [defaultRule("source")] }] })}>+ Group</button>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange, knownPages }: { rule: Rule; onChange: (r: Rule) => void; knownPages: string[] }) {
  const meta = FIELD_META[rule.field];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <select value={rule.field} onChange={(e) => onChange(defaultRule(e.target.value as Rule["field"]))} className={inputCls}>
        {FIELDS.map((f) => <option key={f} value={f}>{FIELD_META[f].label}</option>)}
      </select>
      <select value={rule.cmp} onChange={(e) => onChange(defaultRule(rule.field, e.target.value))} className={inputCls}>
        {meta.cmps.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <ValueEditor rule={rule} onChange={onChange} knownPages={knownPages} />
    </div>
  );
}

function ValueEditor({ rule, onChange, knownPages }: { rule: Rule; onChange: (r: Rule) => void; knownPages: string[] }) {
  const num = (v: string) => Math.max(0, parseInt(v || "0", 10) || 0);
  switch (rule.field) {
    case "source":
    case "utm_source":
      if (rule.cmp === "in") {
        const vals = Array.isArray(rule.value) ? rule.value : [rule.value];
        return (
          <div className="flex flex-wrap gap-1">
            {SOURCES.map((s) => (
              <label key={s} className={`cursor-pointer rounded-full px-2 py-0.5 text-xs ring-1 ${vals.includes(s) ? "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900" : "ring-neutral-300 dark:ring-neutral-700"}`}>
                <input type="checkbox" className="sr-only" checked={vals.includes(s)} onChange={(e) => {
                  const next = e.target.checked ? [...vals, s] : vals.filter((x) => x !== s);
                  onChange({ ...rule, value: next.length ? next : [s] } as Rule);
                }} />{s}
              </label>
            ))}
          </div>
        );
      }
      return <Select value={String(rule.value)} options={SOURCES} onChange={(v) => onChange({ ...rule, value: v } as Rule)} />;
    case "status":
      return <Select value={rule.value} options={STATUSES} onChange={(v) => onChange({ ...rule, value: v } as Rule)} />;
    case "churn_tier":
      return <Select value={rule.value} options={CHURN_TIERS} labels={TIER_LABEL} onChange={(v) => onChange({ ...rule, value: v } as Rule)} />;
    case "signup_date":
      return rule.cmp === "in_last_days"
        ? <Days value={Number(rule.value)} onChange={(v) => onChange({ ...rule, value: v })} />
        : <input type="date" value={String(rule.value)} onChange={(e) => onChange({ ...rule, value: e.target.value })} className={inputCls} />;
    case "days_since_open":
      if (rule.cmp === "never") return null;
      if (rule.cmp === "between") {
        const [a, b] = Array.isArray(rule.value) ? rule.value : [0, 0];
        return <><Num value={a} onChange={(v) => onChange({ ...rule, value: [v, b] })} /><span className="text-xs text-neutral-500">and</span><Num value={b} onChange={(v) => onChange({ ...rule, value: [a, v] })} /><span className="text-xs text-neutral-500">days</span></>;
      }
      return <Days value={Number(rule.value ?? 30)} onChange={(v) => onChange({ ...rule, value: v })} />;
    case "visited_page":
      return (
        <>
          <input list="known-pages" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} className={`${inputCls} w-56 font-mono`} placeholder="/podcast" />
          <datalist id="known-pages">{knownPages.map((p) => <option key={p} value={p} />)}</datalist>
          {rule.cmp === "at_least" && <><Num value={rule.times ?? 1} onChange={(v) => onChange({ ...rule, times: v })} /><span className="text-xs text-neutral-500">times</span></>}
        </>
      );
    case "web_visits":
      return <><Num value={rule.value} onChange={(v) => onChange({ ...rule, value: v })} /><span className="text-xs text-neutral-500">visits in last</span><Days value={rule.days} onChange={(v) => onChange({ ...rule, days: v })} /></>;
    case "has_app":
      return null;
    case "app_events":
      return (
        <>
          <Num value={rule.value} onChange={(v) => onChange({ ...rule, value: v })} />
          <select value={rule.event ?? ""} onChange={(e) => onChange({ ...rule, event: (e.target.value || undefined) as Rule extends { event?: infer E } ? E : never })} className={inputCls}>
            <option value="">any event</option>
            {APP_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-neutral-500">in last</span>
          <Days value={rule.days} onChange={(v) => onChange({ ...rule, days: v })} />
        </>
      );
    case "last_app_activity":
      return <Days value={rule.value} onChange={(v) => onChange({ ...rule, value: v })} />;
    case "engagement_score":
      if (rule.cmp === "between") {
        const [a, b] = Array.isArray(rule.value) ? rule.value : [0, 100];
        return <><Num value={a} max={100} onChange={(v) => onChange({ ...rule, value: [v, b] })} /><span className="text-xs text-neutral-500">and</span><Num value={b} max={100} onChange={(v) => onChange({ ...rule, value: [a, v] })} /></>;
      }
      return <Num value={Number(rule.value)} max={100} onChange={(v) => onChange({ ...rule, value: v })} />;
  }
  void num;
}

function Select<T extends string>({ value, options, labels, onChange }: { value: string; options: readonly T[]; labels?: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
      {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}
function Num({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) {
  return <input type="number" min={0} max={max} value={value} onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || "0", 10) || 0))} className={`${inputCls} w-20`} />;
}
function Days({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <><Num value={value} onChange={onChange} /><span className="text-xs text-neutral-500">days</span></>;
}
