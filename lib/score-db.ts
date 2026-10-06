import { db } from "@/lib/db";
import { churnTier, engagementScore } from "@/lib/score";

/**
 * Recompute engagement_score + churn_tier. Formula lives only in lib/score.ts;
 * the DB just supplies the activity counts (view subscriber_activity).
 * Pass subscriber ids to recompute a few (webhook path) or nothing for all (import).
 */
export async function recomputeScores(subscriberIds?: number[]): Promise<number> {
  const supabase = db();
  let updated = 0;
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("subscriber_activity")
      .select("subscriber_id, web_last30, app_last30")
      .order("subscriber_id")
      .range(from, from + PAGE - 1);
    if (subscriberIds?.length) q = q.in("subscriber_id", subscriberIds);
    const { data: act, error } = await q;
    if (error) throw new Error(`subscriber_activity: ${error.message}`);
    if (!act?.length) break;

    const ids = act.map((a) => a.subscriber_id);
    const { data: subs, error: e2 } = await supabase
      .from("subscribers")
      .select("id,last_open_date")
      .in("id", ids);
    if (e2) throw new Error(`subscribers: ${e2.message}`);
    const lastOpen = new Map(subs!.map((s) => [s.id, s.last_open_date as string | null]));

    const updates = act.map((a) => {
      const lo = lastOpen.get(a.subscriber_id) ?? null;
      const score = engagementScore({
        lastOpenDate: lo ? new Date(`${lo}T00:00:00Z`) : null,
        webVisitsLast30d: Number(a.web_last30),
        appEventsLast30d: Number(a.app_last30),
      });
      return { id: a.subscriber_id, engagement_score: score.total, churn_tier: churnTier(score.total) };
    });

    // Update in parallel batches; each is a tiny PK-targeted write.
    for (let i = 0; i < updates.length; i += 50) {
      await Promise.all(
        updates.slice(i, i + 50).map((u) =>
          supabase.from("subscribers").update({ engagement_score: u.engagement_score, churn_tier: u.churn_tier }).eq("id", u.id),
        ),
      );
    }
    updated += updates.length;
    if (act.length < PAGE) break;
  }
  return updated;
}
