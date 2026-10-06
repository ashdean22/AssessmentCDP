"use client";

import { useState } from "react";
import type { BeehiivPushPlan } from "@/lib/beehiiv";

type Plan = BeehiivPushPlan & { ran: string; logged_at: string };

/**
 * "Push to beehiiv" in MOCK MODE: asks the server for the exact requests it
 * would send and shows them. Nothing reaches beehiiv.
 */
export function BeehiivPush({ filter, name, className }: { filter: unknown; name: string; className: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const push = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/beehiiv/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter, name }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Push failed"); return; }
    setPlan(j);
  };

  return (
    <>
      <button type="button" className={className} onClick={push} disabled={busy} title="Mock mode: shows the requests, sends nothing">
        {busy ? "Preparing…" : "Push to beehiiv"}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
      {plan && (
        <div className="basis-full rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Mock mode</span>
            <span className="text-neutral-700 dark:text-neutral-300">
              Would send <b>{plan.total_requests.toLocaleString()}</b> × <code>{plan.method} {plan.url}</code> for “{plan.segment}”. Logged on the server at {plan.logged_at.slice(11, 19)} UTC. Nothing was sent.
            </span>
            <button className="ml-auto text-neutral-500 hover:underline" onClick={() => setPlan(null)}>close</button>
          </div>
          <div className="mt-1 text-neutral-500">beehiiv has no bulk endpoint, so it is one request per subscriber. Headers: {JSON.stringify(plan.headers)}</div>
          <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 dark:bg-neutral-950">{JSON.stringify(plan.sample, null, 2)}</pre>
          {plan.total_requests > plan.sample.length && <div className="mt-1 text-neutral-500">Showing the first {plan.sample.length} of {plan.total_requests.toLocaleString()} request bodies.</div>}
        </div>
      )}
    </>
  );
}
