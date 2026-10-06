import "server-only";
import { db } from "@/lib/db";
import { compileFilter, type Compiled } from "./compile";

export interface SegmentRow {
  id: number;
  email: string;
  email_hash: string;
  status: string;
  source: string;
  signup_date: string | null;
  last_open_date: string | null;
  engagement_score: number | null;
  churn_tier: string | null;
}

export async function countSegment(filter: unknown): Promise<{ count: number; compiled: Compiled }> {
  const compiled = compileFilter(filter);
  const { data, error } = await db().rpc("segment_count", {
    where_clause: compiled.where,
    params: compiled.params,
  });
  if (error) throw new Error(`segment_count: ${error.message}`);
  return { count: Number(data), compiled };
}

export async function segmentRows(
  filter: unknown,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: SegmentRow[]; compiled: Compiled }> {
  const compiled = compileFilter(filter);
  const { data, error } = await db().rpc("segment_rows", {
    where_clause: compiled.where,
    params: compiled.params,
    lim: opts.limit ?? 100,
    off: opts.offset ?? 0,
  });
  if (error) throw new Error(`segment_rows: ${error.message}`);
  return { rows: (data ?? []) as SegmentRow[], compiled };
}
