import "server-only";
import { db } from "@/lib/db";
import { DAY_MS, REFERENCE_DATE } from "@/lib/config";
import { normalizeEmail } from "@/lib/normalize";
import { churnTier, engagementScore, type ChurnTier, type ScoreBreakdown } from "@/lib/score";

export interface TimelineItem {
  kind: "web" | "app";
  ts: string; // ISO
  title: string; // page path or event name
  detail: string | null; // utm source or story slug etc.
  id: string; // visitor_id or device_id
}

export interface Profile {
  subscriber: {
    id: number;
    email: string;
    status: string;
    source: string;
    signup_date: string | null;
    last_open_date: string | null;
    merged_count: number;
  };
  score: ScoreBreakdown;
  tier: ChurnTier;
  visitorIds: string[];
  appUsers: { user_id: string; created_at: string | null; is_stub: boolean }[];
  deviceIds: string[];
  timeline: TimelineItem[];
  counts: { web: number; app: number; webLast30d: number; appLast30d: number };
  lastActive: string | null;
}

export type LookupResult =
  | { status: "found"; profile: Profile; normalized: string }
  | { status: "not_found"; normalized: string }
  | { status: "invalid" };

export async function lookupByEmail(raw: string): Promise<LookupResult> {
  const email = normalizeEmail(raw);
  if (!email) return { status: "invalid" };

  const supabase = db();
  const { data: sub, error } = await supabase
    .from("subscribers")
    .select("id,email,status,source,signup_date,last_open_date,merged_count")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) return { status: "not_found", normalized: email };

  const [{ data: web }, { data: users }] = await Promise.all([
    supabase
      .from("web_events")
      .select("visitor_id,page,ts,utm_source")
      .eq("subscriber_id", sub.id)
      .order("ts", { ascending: false })
      .limit(1000),
    supabase
      .from("app_users")
      .select("user_id,created_at,is_stub")
      .eq("subscriber_id", sub.id),
  ]);

  const userIds = (users ?? []).map((u) => u.user_id);
  const [{ data: devices }, { data: appEvents }] = userIds.length
    ? await Promise.all([
        supabase.from("devices").select("device_id").in("user_id", userIds),
        supabase
          .from("app_events")
          .select("event,device_id,ts,properties")
          .in("resolved_user_id", userIds)
          .order("ts", { ascending: false })
          .limit(1000),
      ])
    : [{ data: [] }, { data: [] }];

  const timeline: TimelineItem[] = [
    ...(web ?? []).map((w) => ({
      kind: "web" as const,
      ts: w.ts,
      title: w.page,
      detail: w.utm_source ? `utm: ${w.utm_source}` : null,
      id: w.visitor_id,
    })),
    ...(appEvents ?? []).map((e) => {
      const props = (e.properties ?? {}) as Record<string, unknown>;
      const detail = typeof props.story === "string" ? props.story : typeof props.url === "string" ? props.url : null;
      return { kind: "app" as const, ts: e.ts, title: e.event, detail, id: e.device_id };
    }),
  ].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)); // newest first, by event time

  const cutoff = new Date(REFERENCE_DATE.getTime() - 30 * DAY_MS).toISOString();
  const webLast30d = (web ?? []).filter((w) => w.ts >= cutoff).length;
  const appLast30d = (appEvents ?? []).filter((e) => e.ts >= cutoff).length;
  const score = engagementScore({
    lastOpenDate: sub.last_open_date ? new Date(`${sub.last_open_date}T00:00:00Z`) : null,
    webVisitsLast30d: webLast30d,
    appEventsLast30d: appLast30d,
  });

  return {
    status: "found",
    normalized: email,
    profile: {
      subscriber: sub,
      score,
      tier: churnTier(score.total),
      visitorIds: [...new Set((web ?? []).map((w) => w.visitor_id))],
      appUsers: users ?? [],
      deviceIds: (devices ?? []).map((d) => d.device_id),
      timeline,
      counts: { web: (web ?? []).length, app: (appEvents ?? []).length, webLast30d, appLast30d },
      lastActive: timeline[0]?.ts ?? null,
    },
  };
}
