import Link from "next/link";
import { db } from "@/lib/db";
import { SOURCES, STATUSES } from "@/lib/normalize";
import { CHURN_TIERS, TIER_LABEL } from "@/lib/score";
import { emailPrefix } from "@/lib/search";
import { Info } from "../info";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribers · TPO CDP" };

const PAGE = 50;
const SORTS = {
  last_open: { col: "last_open_date", asc: false, label: "Last open" },
  score: { col: "engagement_score", asc: false, label: "Score" },
  signup: { col: "signup_date", asc: false, label: "Newest" },
  email: { col: "email", asc: true, label: "Email A–Z" },
} as const;
type SortKey = keyof typeof SORTS;

type Row = { id: number; email: string; status: string; source: string; signup_date: string | null; last_open_date: string | null; engagement_score: number | null; churn_tier: string | null; merged_count: number };

const TIER_DOT: Record<string, string> = { active: "bg-emerald-500", cooling: "bg-amber-400", at_risk: "bg-coral", cold: "bg-neutral-400" };
const sel = "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-espresso dark:border-neutral-700 dark:bg-neutral-950";

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort: SortKey = (sp.sort as SortKey) in SORTS ? (sp.sort as SortKey) : "last_open";
  const tier = CHURN_TIERS.includes(sp.tier as never) ? sp.tier! : "";
  const status = STATUSES.includes(sp.status as never) ? sp.status! : "";
  const source = SOURCES.includes(sp.source as never) ? sp.source! : "";
  const q = sp.q ?? "";
  const prefix = emailPrefix(q);

  let query = db().from("subscribers").select("id,email,status,source,signup_date,last_open_date,engagement_score,churn_tier,merged_count", { count: "exact" });
  if (tier) query = query.eq("churn_tier", tier);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (prefix) query = query.like("email", `${prefix}%`);
  const s = SORTS[sort];
  query = query.order(s.col, { ascending: s.asc, nullsFirst: false }).order("id").range((page - 1) * PAGE, page * PAGE - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const all = { sort, tier, status, source, q, page, ...over };
    for (const [k, v] of Object.entries(all)) if (v !== "" && v != null && !(k === "page" && Number(v) === 1)) p.set(k, String(v));
    const qs = p.toString();
    return `/subscribers${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Subscribers</h1>
        <Info text="Every deduped reader, straight from the database. Filter by tier, status or source, sort, and click an email to open the full profile." />
      </div>
      <p className="mt-1 text-sm text-neutral-500">{total.toLocaleString()} readers{tier || status || source || prefix ? " match" : ""}. Click a row to open the profile.</p>

      <form method="get" action="/subscribers" className="mt-5 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="email starts with…" className={`${sel} w-56`} />
        <select name="tier" defaultValue={tier} className={sel}><option value="">Any tier</option>{CHURN_TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
        <select name="status" defaultValue={status} className={sel}><option value="">Any status</option>{STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select name="source" defaultValue={source} className={sel}><option value="">Any source</option>{SOURCES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select name="sort" defaultValue={sort} className={sel}>{(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}</select>
        <button className="rounded-full bg-espresso px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">Apply</button>
        {(tier || status || source || q) && <Link href="/subscribers" className="text-sm text-neutral-500 hover:underline">clear</Link>}
      </form>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
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
        <span>Page {page} of {pages}</span>
        <div className="ml-auto flex gap-2">
          {page > 1 && <Link href={href({ page: page - 1 })} className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">← Prev</Link>}
          {page < pages && <Link href={href({ page: page + 1 })} className="rounded-full border border-neutral-300 px-3 py-1 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">Next →</Link>}
        </div>
      </div>
    </div>
  );
}
