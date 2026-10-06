/**
 * npm run import
 *
 * Reads the three CSVs, cleans, dedupes, links, and upserts into Supabase.
 * Re-runnable: every write is an upsert on a natural key, so running twice
 * yields the same database. Prints a report at the end.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: false });

import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { emailHash } from "@/lib/pii/mask";
import { toDateString } from "@/lib/normalize";
import {
  cleanAppUsers,
  cleanSubscribers,
  cleanWebEvents,
  dedupeSubscribers,
  stitchVisitors,
  type Issue,
  type RawRow,
} from "@/lib/import/merge";

const CHUNK = 500;
const runId = new Date().toISOString();

function load(file: string): RawRow[] {
  return parse(readFileSync(`data/${file}`, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });
}

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const supabase = db();
  const t0 = Date.now();
  const report: Record<string, number> = {};

  // ---------------------------------------------------------------- subscribers
  const subRaw = load("subscribers.csv");
  const { clean: subClean, issues: subIssues } = cleanSubscribers(subRaw);
  const merged = dedupeSubscribers(subClean);
  report["subscribers.csv rows read"] = subRaw.length;
  report["subscribers rejected"] = subRaw.length - subClean.length;
  report["subscribers merged (dup rows collapsed)"] = subClean.length - merged.length;
  report["subscribers written"] = merged.length;

  const emailToId = new Map<string, number>();
  for (const batch of chunks(merged, CHUNK)) {
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        batch.map((s) => ({
          email: s.email,
          email_hash: emailHash(s.email),
          signup_date: s.signup_date ? toDateString(s.signup_date) : null,
          status: s.status,
          source: s.source,
          last_open_date: s.last_open_date ? toDateString(s.last_open_date) : null,
          merged_count: s.merged_count,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "email" },
      )
      .select("id,email");
    if (error) throw new Error(`subscribers upsert: ${error.message}`);
    for (const r of data ?? []) emailToId.set(r.email, r.id);
  }

  // ---------------------------------------------------------------- web events
  const webRaw = load("web_events.csv");
  const { clean: webClean, issues: webIssues } = cleanWebEvents(webRaw);
  const visitorEmail = stitchVisitors(webClean, new Set(emailToId.keys()));
  let webLinked = 0;
  for (const batch of chunks(webClean, CHUNK)) {
    const rows = batch.map((e) => {
      const email = visitorEmail.get(e.visitor_id) ?? null;
      const subscriber_id = email ? emailToId.get(email) ?? null : null;
      if (subscriber_id) webLinked++;
      return {
        visitor_id: e.visitor_id,
        page: e.page,
        ts: e.ts.toISOString(),
        utm_source: e.utm_source,
        email: e.email,
        subscriber_id,
      };
    });
    const { error } = await supabase
      .from("web_events")
      .upsert(rows, { onConflict: "visitor_id,page,ts" });
    if (error) throw new Error(`web_events upsert: ${error.message}`);
  }
  report["web_events.csv rows read"] = webRaw.length;
  report["web events rejected"] = webRaw.length - webClean.length;
  report["web events written"] = webClean.length;
  report["web events linked to a subscriber"] = webLinked;
  report["visitors stitched to a subscriber"] = visitorEmail.size;

  // ---------------------------------------------------------------- app users
  const appRaw = load("app_users.csv");
  const { clean: appClean, issues: appIssues } = cleanAppUsers(appRaw);
  let appLinked = 0;
  for (const batch of chunks(appClean, CHUNK)) {
    const rows = batch.map((u) => {
      const subscriber_id = u.email ? emailToId.get(u.email) ?? null : null;
      if (subscriber_id) appLinked++;
      return {
        user_id: u.user_id,
        email: u.email,
        created_at: u.created_at ? u.created_at.toISOString() : null,
        subscriber_id,
        is_stub: false, // a CSV row is authoritative; it upgrades any webhook-created stub
      };
    });
    const { error } = await supabase.from("app_users").upsert(rows, { onConflict: "user_id" });
    if (error) throw new Error(`app_users upsert: ${error.message}`);
  }
  report["app_users.csv rows read"] = appRaw.length;
  report["app users rejected"] = appRaw.length - appClean.length;
  report["app users written"] = appClean.length;
  report["app users linked to a subscriber"] = appLinked;

  // ---------------------------------------------------------------- issues
  const issues: Issue[] = [...subIssues, ...webIssues, ...appIssues];
  const { error: delErr } = await supabase
    .from("import_issues")
    .delete()
    .in("file", ["subscribers.csv", "web_events.csv", "app_users.csv"]);
  if (delErr) throw new Error(`import_issues clear: ${delErr.message}`);
  for (const batch of chunks(issues, CHUNK)) {
    const { error } = await supabase.from("import_issues").insert(
      batch.map((i) => ({ run_id: runId, file: i.file, row_number: i.row_number, problem: i.problem, raw: i.raw })),
    );
    if (error) throw new Error(`import_issues insert: ${error.message}`);
  }
  report["import issues logged"] = issues.length;

  // ---------------------------------------------------------------- report
  console.log(`\nImport report (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  const w = Math.max(...Object.keys(report).map((k) => k.length));
  for (const [k, v] of Object.entries(report)) console.log(`  ${k.padEnd(w)}  ${v}`);
  if (issues.length) {
    console.log("\nIssues by type:");
    const byType = new Map<string, number>();
    for (const i of issues) {
      const key = `${i.file}: ${i.problem.replace(/".*"/, '"…"')}`;
      byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    for (const [k, n] of byType) console.log(`  ${n.toString().padStart(4)}  ${k}`);
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
