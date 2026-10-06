import { lookupByEmail } from "@/lib/profile";
import { TIER_LABEL } from "@/lib/score";
import { daysAgo } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lookup · TPO CDP" };

function fmtDate(d: string | null) {
  return d ? d.slice(0, 10) : "—";
}
function fmtTs(ts: string) {
  return ts.replace("T", " ").replace(/\.\d+Z$/, "Z").replace(/:\d\dZ$/, " UTC");
}

const TIER_CLASS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cooling: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  at_risk: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  cold: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  const result = email ? await lookupByEmail(email) : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Find anyone</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Search by email. Case and spaces don&apos;t matter — the same normalizer as the import is applied.
      </p>

      <form className="mt-6 flex gap-2" action="/lookup" method="get">
        <input
          name="email"
          type="text"
          defaultValue={email}
          placeholder="name@example.com"
          autoFocus
          className="w-full max-w-md rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
        />
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">
          Search
        </button>
      </form>

      {result?.status === "invalid" && (
        <p className="mt-6 text-sm text-red-600">That doesn&apos;t look like an email address.</p>
      )}
      {result?.status === "not_found" && (
        <p className="mt-6 text-sm text-neutral-600">
          No subscriber found for <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{result.normalized}</code>.
        </p>
      )}

      {result?.status === "found" && (() => {
        const p = result.profile;
        const s = p.subscriber;
        const openDays = daysAgo(s.last_open_date ? new Date(`${s.last_open_date}T00:00:00Z`) : null);
        return (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Newsletter card */}
            <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-neutral-500">Newsletter</h2>
                  <div className="mt-1 break-all font-medium">{s.email}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_CLASS[p.tier]}`}>
                  {TIER_LABEL[p.tier]}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-neutral-500">Status</dt>
                <dd className="capitalize">{s.status}</dd>
                <dt className="text-neutral-500">Source</dt>
                <dd className="capitalize">{s.source}</dd>
                <dt className="text-neutral-500">Signed up</dt>
                <dd>{fmtDate(s.signup_date)}</dd>
                <dt className="text-neutral-500">Last open</dt>
                <dd>
                  {fmtDate(s.last_open_date)}
                  {openDays !== null && <span className="text-neutral-500"> · {openDays}d ago</span>}
                  {openDays === null && <span className="text-neutral-500"> · never</span>}
                </dd>
                <dt className="text-neutral-500">Engagement</dt>
                <dd>
                  <span className="text-lg font-semibold tabular-nums">{p.score.total}</span>
                  <span className="text-neutral-500"> /100</span>
                  <div className="mt-1 text-xs text-neutral-500">
                    recency {p.score.recency} · web {p.score.web} · app {p.score.app}
                  </div>
                </dd>
                <dt className="text-neutral-500">Last active</dt>
                <dd>{p.lastActive ? fmtTs(p.lastActive) : "—"}</dd>
                {s.merged_count > 1 && (
                  <>
                    <dt className="text-neutral-500">Merged rows</dt>
                    <dd>{s.merged_count}</dd>
                  </>
                )}
              </dl>

              <h3 className="mt-6 text-sm font-medium text-neutral-500">Linked IDs</h3>
              <div className="mt-2 space-y-2 text-xs">
                <IdList label="Visitor IDs" ids={p.visitorIds} />
                <IdList label="App user IDs" ids={p.appUsers.map((u) => u.user_id + (u.is_stub ? " (stub)" : ""))} />
                <IdList label="Devices" ids={p.deviceIds} />
              </div>
            </section>

            {/* Timeline */}
            <section className="rounded-xl border border-neutral-200 p-5 lg:col-span-2 dark:border-neutral-800">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-neutral-500">Activity timeline</h2>
                <div className="text-xs text-neutral-500">
                  {p.counts.web} web visits · {p.counts.app} app events · sorted by event time
                </div>
              </div>
              {p.timeline.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-500">No web or app activity linked to this subscriber.</p>
              ) : (
                <ol className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
                  {p.timeline.slice(0, 200).map((t, i) => (
                    <li key={i} className="flex items-center gap-3 py-2 text-sm">
                      <span
                        className={`w-10 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase ${
                          t.kind === "web"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                            : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                        }`}
                      >
                        {t.kind}
                      </span>
                      <span className="w-40 shrink-0 font-mono text-xs text-neutral-500">{fmtTs(t.ts)}</span>
                      <span className="truncate font-medium">{t.title}</span>
                      {t.detail && <span className="truncate text-neutral-500">{t.detail}</span>}
                      <span className="ml-auto shrink-0 font-mono text-xs text-neutral-400">{t.id}</span>
                    </li>
                  ))}
                </ol>
              )}
              {p.timeline.length > 200 && (
                <p className="mt-2 text-xs text-neutral-500">Showing the latest 200 of {p.timeline.length}.</p>
              )}
            </section>
          </div>
        );
      })()}
    </div>
  );
}

function IdList({ label, ids }: { label: string; ids: string[] }) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      {ids.length === 0 ? (
        <div className="text-neutral-400">none</div>
      ) : (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {ids.map((id) => (
            <code key={id} className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              {id}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}
