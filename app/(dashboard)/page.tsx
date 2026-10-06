import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = db();
  const [subs, web, app] = await Promise.all([
    supabase.from("subscribers").select("*", { count: "exact", head: true }),
    supabase.from("web_events").select("*", { count: "exact", head: true }),
    supabase.from("app_users").select("*", { count: "exact", head: true }),
  ]);
  const cards = [
    { label: "Subscribers", value: subs.count ?? 0 },
    { label: "Web events", value: web.count ?? 0 },
    { label: "App users", value: app.count ?? 0 },
  ];
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">Full dashboard lands Oct 16. For now, counts from the live database.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="text-sm text-neutral-500">{c.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm">
        Try <Link href="/lookup" className="underline">Lookup</Link> to find a subscriber by email.
      </p>
    </div>
  );
}
