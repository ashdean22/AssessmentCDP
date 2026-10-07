import "server-only";
import { db } from "@/lib/db";
import { emailPrefix } from "@/lib/search";
import { PAGE_SIZE, SORTS, type ListParams, type SubscriberRow } from "@/lib/subscribers-list";

/** Shared by the page's first render and the live-filter API. */
export async function listSubscribers(p: ListParams): Promise<{ rows: SubscriberRow[]; total: number }> {
  let query = db().from("subscribers").select("id,email,status,source,signup_date,last_open_date,engagement_score,churn_tier,merged_count", { count: "exact" });
  if (p.tier) query = query.eq("churn_tier", p.tier);
  if (p.status) query = query.eq("status", p.status);
  if (p.source) query = query.eq("source", p.source);
  const prefix = emailPrefix(p.q);
  if (prefix) query = query.like("email", `${prefix}%`);
  const s = SORTS[p.sort];
  query = query.order(s.col, { ascending: s.asc, nullsFirst: false }).order("id").range((p.page - 1) * PAGE_SIZE, p.page * PAGE_SIZE - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as SubscriberRow[], total: count ?? 0 };
}
