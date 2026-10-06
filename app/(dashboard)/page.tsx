import Link from "next/link";
import { db } from "@/lib/db";
import { TIER_LABEL, type ChurnTier } from "@/lib/score";
import type { Filter } from "@/lib/segments/fields";
import { FirstPagesBar, OpensLine, SourceBar } from "./charts";
import { EventFeed } from "./event-feed";
import { WinBack } from "./winback";
import { Info } from "./info";

export const dynamic = "force-dynamic";

type Stats = {
  subscribers: number; active: number; cold: number; app_users: number; web_events: number; app_events: number; events_today: number;
  tiers: Record<string, number>; by_source: { source: string; count: number }[];
};
type Series = { period: string; count: number }[];
type FirstPages = { new_subscribers: number; with_a_first_page: number; pages: { page: string; count: number; pct: number }[] };

const AT_RISK: Filter = { op: "AND", rules: [{ field: "churn_tier", cmp: "is", value: "at_risk" }] };
const TIER_CLASS: Record<ChurnTier, string> = {
  active: "bg-emerald-500", cooling: "bg-amber-400", at_risk: "bg-orange-500", cold: "bg-neutral-400",
};
const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);

export default async function Home() {
  const supabase = db();
  const [stats, signups, opens, first] = await Promise.all([
    supabase.rpc("dashboard_stats").then((r) => { if (r.error) throw new Error(r.error.message); return r.data as Stats; }),
    supabase.rpc("trend", { metric: "signups", bucket: "week", periods: 12 }).then((r) => (r.data ?? []) as Series),
    supabase.rpc("trend", { metric: "last_opens", bucket: "week", periods: 12 }).then((r) => (r.data ?? []) as Series),
    supabase.rpc("first_pages", { new_within_days: 30, lim: 8 }).then((r) => (r.data ?? { new_subscribers: 0, with_a_first_page: 0, pages: [] }) as FirstPages),
  ]);

  const cards = [
    { label: "Total readers", value: stats.subscribers.toLocaleString(), sub: "deduped subscribers" },
    { label: "Active", value: `${pct(stats.active, stats.subscribers)}%`, sub: `${stats.active.toLocaleString()} status = active` },
    { label: "Cold", value: `${pct(stats.cold, stats.subscribers)}%`, sub: "no open in 30+ days, or never" },
    { label: "App users", value: stats.app_users.toLocaleString(), sub: `${stats.app_events.toLocaleString()} app events total` },
    { label: "Events today", value: stats.events_today.toLocaleString(), sub: "app events dated 2026-09-28" },
  ];
  const tiers = (["active", "cooling", "at_risk", "cold"] as ChurnTier[]).map((t) => ({ tier: t, n: stats.tiers[t] ?? 0 }));
  const signupTotal = signups.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">Dashboard</h1><Info text="The whole readership at a glance. Every number comes live from the database; nothing is cached." /></div>
        <span className="text-xs text-neutral-500">“today” = 2026-09-28 (assessment reference date)</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">{c.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{c.value}</div>
            <div className="mt-1 text-[11px] text-neutral-400">{c.sub}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">Churn risk <Info text="Each reader gets a 0–100 engagement score from newsletter recency, web visits and app events in the last 30 days, then a tier. It is recomputed on every webhook event." /></h2>
          <span className="text-xs text-neutral-400">engagement score: recency ≤40 + web ≤30 + app ≤30 · Active 70+, Cooling 40–69, At risk 15–39, Cold &lt;15</span>
        </div>
        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          {tiers.map((t) => <div key={t.tier} className={TIER_CLASS[t.tier]} style={{ width: `${pct(t.n, stats.subscribers)}%` }} title={`${TIER_LABEL[t.tier]} ${t.n}`} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {tiers.map((t) => (
            <Link key={t.tier} href="/segments" className="flex items-center gap-1.5 hover:underline">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${TIER_CLASS[t.tier]}`} />
              {TIER_LABEL[t.tier]} <b className="tabular-nums">{t.n.toLocaleString()}</b> <span className="text-neutral-400">({pct(t.n, stats.subscribers)}%)</span>
            </Link>
          ))}
        </div>
      </section>

      <WinBack count={stats.tiers.at_risk ?? 0} filter={AT_RISK} name="At risk readers" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">Signups by source <Info text="Where readers came from, after the import normalised spellings (IG, insta, Instagram → instagram)." /></h2>
          <p className="mb-2 text-xs text-neutral-400">All-time, after source normalisation (IG / insta / Instagram → instagram)</p>
          <SourceBar data={stats.by_source} />
        </section>
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">Open activity, last 12 weeks <Info text="How many readers had their most recent open in each week. The data holds one last-open date per reader, so this is recency, not total opens." /></h2>
          <p className="mb-2 text-xs text-neutral-400">Readers whose <i>last</i> open falls in each week. The data only holds one last-open date per reader, so this is not total opens.</p>
          <OpensLine data={opens} />
        </section>
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">Signups, last 12 weeks <Info text="New subscribers per week, ending at the reference date." /></h2>
          <p className="mb-2 text-xs text-neutral-400">{signupTotal.toLocaleString()} signups by week</p>
          <OpensLine data={signups} />
        </section>
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">First pages new subscribers visit <Info text="For readers who signed up in the last 30 days: the first page they visited on or after signup day. Tells you what a fresh reader actually wants." /></h2>
          <p className="mb-2 text-xs text-neutral-400">
            Earliest visit on or after signup · {first.with_a_first_page} of {first.new_subscribers} subscribers who signed up in the last 30 days had a tracked visit
          </p>
          {first.pages.length ? <FirstPagesBar data={first.pages} /> : <p className="text-sm text-neutral-400">No linked visits yet.</p>}
        </section>
      </div>

      <EventFeed />
    </div>
  );
}
