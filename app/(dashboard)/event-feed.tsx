"use client";

import { useEffect, useRef, useState } from "react";

type Ev = { event_id: string; event: string; user_id: string | null; device_id: string; ts: string; properties: Record<string, unknown>; resolved_user_id: string | null; received_at: string };

const EVENT_CLASS: Record<string, string> = {
  app_open: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  read_story: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  link_click: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  login: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const fmt = (ts: string) => ts.replace("T", " ").replace(/(\.\d+)?Z$/, "").slice(0, 16);

/** Polls the newest webhook arrivals every few seconds; new rows flash in. */
export function EventFeed({ intervalMs = 4000 }: { intervalMs?: number }) {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [updated, setUpdated] = useState<string>("");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/events/recent?limit=15", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const { events: list } = (await r.json()) as { events: Ev[] };
        const ids = new Set(list.map((e) => e.event_id));
        if (seen.current) setFresh(new Set(list.filter((e) => !seen.current!.has(e.event_id)).map((e) => e.event_id)));
        seen.current = ids;
        setEvents(list);
        setUpdated(new Date().toLocaleTimeString());
      } catch { /* keep the last list */ }
    };
    tick();
    const h = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(h); };
  }, [intervalMs]);

  return (
    <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-500">Live event feed</h2>
        <div className="text-xs text-neutral-400">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          newest arrivals · refreshes every {Math.round(intervalMs / 1000)}s{updated && ` · ${updated}`}
        </div>
      </div>
      {!events ? (
        <p className="mt-3 text-sm text-neutral-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">No app events yet. Send one to <code>POST /webhooks/app</code>.</p>
      ) : (
        <ol className="mt-3 divide-y divide-neutral-100 text-xs dark:divide-neutral-800">
          {events.map((e) => {
            const who = e.resolved_user_id ?? e.user_id;
            const story = typeof e.properties?.story === "string" ? e.properties.story : null;
            return (
              <li key={e.event_id} className={`flex items-center gap-2 py-1.5 transition-colors ${fresh.has(e.event_id) ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                <span className={`w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${EVENT_CLASS[e.event] ?? "bg-neutral-100"}`}>{e.event}</span>
                <span className="w-28 shrink-0 font-mono text-neutral-500" title={`event time ${e.ts} · received ${e.received_at}`}>{fmt(e.ts)}</span>
                <span className="truncate font-mono">{who ?? <span className="text-neutral-400">anonymous</span>}{!e.user_id && e.resolved_user_id && <span className="text-neutral-400"> (via device)</span>}</span>
                {story && <span className="truncate text-neutral-500">· {story}</span>}
                <span className="ml-auto shrink-0 font-mono text-neutral-400">{e.device_id}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
