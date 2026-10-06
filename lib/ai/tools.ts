import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEFINITIONS } from "@/lib/metrics";
import { maskedId } from "@/lib/pii/mask";
import { assertNoPii } from "@/lib/pii/guard";
import { FilterSchema, type Filter } from "@/lib/segments/fields";
import { countSegment, segmentRows } from "@/lib/segments/run";
import { compileFilter } from "@/lib/segments/compile";

/**
 * The only way the model touches data. Every function here returns counts,
 * percentages, page paths, dates or masked ids — and every return value goes
 * through assertNoPii() before it leaves. Full tables are parked in ai_results
 * and referred to by result_id; the browser fetches them behind the login.
 *
 * Shared by the chat route (Vercel AI SDK) and the Vapi voice tool endpoint.
 */

const filterInput = FilterSchema.describe(
  'Filter tree: {"op":"AND"|"OR","rules":[rule|group]}. Rule fields: source(is|is_not|in), status(is|is_not), signup_date(before|after|in_last_days), days_since_open(gt|lt|between|never), visited_page(has|has_not|at_least + times), utm_source(is|in), web_visits(gt|lt, days), has_app(yes|no), app_events(gt|lt, days, event?), last_app_activity(within|older_than), engagement_score(gt|lt|between), churn_tier(is|is_not). Sources: instagram, facebook, google, referral, direct, podcast, twitter, other. Tiers: active, cooling, at_risk, cold.',
);

async function parkResult(kind: string, rows: unknown[], meta: Record<string, unknown>) {
  const { data, error } = await db()
    .from("ai_results")
    .insert({ kind, rows: { rows, meta } })
    .select("result_id")
    .single();
  if (error) throw new Error(`ai_results: ${error.message}`);
  return data.result_id as string;
}

export const toolDefs = {
  count_segment: {
    description: "Count subscribers matching a filter. Use for any 'how many…' question. Returns the count and the exact definition that ran.",
    inputSchema: z.object({ filter: filterInput }),
    execute: async ({ filter }: { filter: Filter }) => {
      const { count, compiled } = await countSegment(filter);
      return assertNoPii({ count, ran: compiled.description, filter });
    },
  },
  build_segment: {
    description: "Build a list of subscribers matching a filter and park the full table under a result_id the UI can display. Returns count, result_id and a few masked ids. Use for 'build me a list / segment of…'.",
    inputSchema: z.object({ filter: filterInput, name: z.string().min(1).max(80).describe("Short human name for the segment") }),
    execute: async ({ filter, name }: { filter: Filter; name: string }) => {
      const { rows, compiled } = await segmentRows(filter, { limit: 5000 });
      const result_id = await parkResult("segment", rows, { name, filter, description: compiled.description });
      // (key is segment_name, not name — the PII guard treats `name` as forbidden)
      return assertNoPii({
        segment_name: name,
        count: rows.length,
        result_id,
        ran: compiled.description,
        sample_ids: rows.slice(0, 5).map((r) => maskedId(r.email_hash)),
        filter,
      });
    },
  },
  top_engaged: {
    description: "The most engaged readers by engagement score (0–100). Returns masked ids with score, tier and source, plus a result_id for the full table.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(10) }),
    execute: async ({ limit }: { limit: number }) => {
      const filter: Filter = { op: "AND", rules: [] };
      const { rows } = await segmentRows(filter, { limit });
      const result_id = await parkResult("segment", rows, { name: `Top ${limit} engaged readers`, filter, description: `top ${limit} by engagement score` });
      return assertNoPii({
        result_id,
        definition: DEFINITIONS.engagement_score,
        readers: rows.map((r) => ({ id: maskedId(r.email_hash), score: r.engagement_score, tier: r.churn_tier, source: r.source, signup_date: r.signup_date })),
      });
    },
  },
  source_quality: {
    description: "Compare acquisition sources: signups, % still active, average engagement score, % with the app, % loyal, % cold. Use for 'which source brings the best/most loyal subscribers'.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data, error } = await db().rpc("source_quality");
      if (error) throw new Error(error.message);
      return assertNoPii({ definitions: { loyal: DEFINITIONS.loyal, cold: DEFINITIONS.cold }, sources: data });
    },
  },
  first_pages: {
    description: "Which pages new subscribers visit first (earliest visit on or after signup). Use for 'what do new subscribers read/hit first'.",
    inputSchema: z.object({
      new_within_days: z.number().int().min(1).max(365).default(30).describe("How recent a signup counts as 'new'"),
      limit: z.number().int().min(1).max(25).default(10),
    }),
    execute: async ({ new_within_days, limit }: { new_within_days: number; limit: number }) => {
      const { data, error } = await db().rpc("first_pages", { new_within_days, lim: limit });
      if (error) throw new Error(error.message);
      return assertNoPii({ definition: DEFINITIONS.first_page, new_within_days, ...(data as object) });
    },
  },
  app_newsletter_overlap: {
    description: "How app users overlap with the newsletter: matched, never opened, cold, unsubscribed. Use for 'how many app users never open the newsletter'.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data, error } = await db().rpc("app_newsletter_overlap");
      if (error) throw new Error(error.message);
      return assertNoPii({ definition_cold: DEFINITIONS.cold, ...(data as object) });
    },
  },
  trend: {
    description: "Time series for a chart: signups, last_opens (readers whose last open falls in each period), web_visits or app_events per week/day, ending at the reference date.",
    inputSchema: z.object({
      metric: z.enum(["signups", "last_opens", "web_visits", "app_events"]),
      bucket: z.enum(["week", "day"]).default("week"),
      periods: z.number().int().min(1).max(52).default(12),
    }),
    execute: async ({ metric, bucket, periods }: { metric: string; bucket: string; periods: number }) => {
      const { data, error } = await db().rpc("trend", { metric, bucket, periods });
      if (error) throw new Error(error.message);
      return assertNoPii({ metric, bucket, series: data });
    },
  },
  get_definitions: {
    description: "The exact metric definitions (cold, engaged, loyal, new, engagement score, churn tiers). Call when asked what a term means or before using one.",
    inputSchema: z.object({}),
    execute: async () => assertNoPii({ reference_date: "2026-09-28", definitions: DEFINITIONS }),
  },
};

export type ToolName = keyof typeof toolDefs;

/** Run a tool by name with raw (unvalidated) input — used by the Vapi endpoint. */
export async function runTool(name: string, input: unknown) {
  const def = toolDefs[name as ToolName];
  if (!def) throw new Error(`unknown tool ${name}`);
  const parsed = def.inputSchema.parse(input ?? {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (def.execute as (i: any) => Promise<unknown>)(parsed);
}

export { compileFilter };
