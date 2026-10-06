import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Live feed for the dashboard: the newest webhook arrivals. Ordered by
 * received_at so a just-sent event always appears at the top; every other
 * view (timeline, last active) sorts by event time `ts`.
 */
export async function GET(req: Request) {
  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 15));
  const { data, error } = await db()
    .from("app_events")
    .select("event_id,event,user_id,device_id,ts,properties,resolved_user_id,received_at")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
