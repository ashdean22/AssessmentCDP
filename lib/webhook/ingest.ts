import { db } from "@/lib/db";
import { recomputeScores } from "@/lib/score-db";
import type { AppEvent } from "./schema";

export interface IngestResult {
  event_id: string;
  duplicate: boolean;
  resolved_user_id: string | null;
  stub_created: boolean;
  attached_anonymous_events: number;
}

/**
 * Store one app event and keep identities stitched. Idempotent on event_id.
 *
 *  - Repeat event_id → no-op, `duplicate: true`.
 *  - user_id present → make sure the app user exists (stub if unknown; never
 *    dropped), link the device to that user, and attach any earlier anonymous
 *    events from the same device.
 *  - user_id null but device already linked → attach to that user.
 *  - Order of arrival never matters; everything sorts by event `ts`.
 */
export async function ingestAppEvent(ev: AppEvent): Promise<IngestResult> {
  const supabase = db();
  let resolved: string | null = ev.user_id;
  let stubCreated = false;
  let attached = 0;

  if (ev.user_id) {
    // 1. Unknown user_id still gets a profile.
    const { data: existing } = await supabase.from("app_users").select("user_id").eq("user_id", ev.user_id).maybeSingle();
    if (!existing) {
      const { error } = await supabase
        .from("app_users")
        .upsert({ user_id: ev.user_id, is_stub: true }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error(`app_users stub: ${error.message}`);
      stubCreated = true;
    }
    // 2. Device now belongs to this user.
    const { error: devErr } = await supabase
      .from("devices")
      .upsert({ device_id: ev.device_id, user_id: ev.user_id, linked_at: new Date().toISOString() }, { onConflict: "device_id" });
    if (devErr) throw new Error(`devices: ${devErr.message}`);
  } else {
    // 3. Anonymous event on a device we already know.
    const { data: dev } = await supabase.from("devices").select("user_id").eq("device_id", ev.device_id).maybeSingle();
    resolved = dev?.user_id ?? null;
  }

  // 4. Insert; duplicate event_id is silently ignored and returns no row.
  const { data: inserted, error: insErr } = await supabase
    .from("app_events")
    .upsert(
      {
        event_id: ev.event_id,
        event: ev.event,
        user_id: ev.user_id,
        device_id: ev.device_id,
        ts: new Date(ev.timestamp).toISOString(),
        properties: ev.properties,
        resolved_user_id: resolved,
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id");
  if (insErr) throw new Error(`app_events: ${insErr.message}`);
  const duplicate = !inserted || inserted.length === 0;

  // 5. Login (or any identified event) claims earlier anonymous events from this device.
  if (ev.user_id && !duplicate) {
    const { data: upd, error } = await supabase
      .from("app_events")
      .update({ resolved_user_id: ev.user_id })
      .eq("device_id", ev.device_id)
      .is("resolved_user_id", null)
      .select("event_id");
    if (error) throw new Error(`attach anonymous: ${error.message}`);
    attached = upd?.length ?? 0;
  }

  // 6. Keep the engagement score current for the linked subscriber, if any.
  if (resolved && !duplicate) {
    const { data: u } = await supabase.from("app_users").select("subscriber_id").eq("user_id", resolved).maybeSingle();
    if (u?.subscriber_id) await recomputeScores([u.subscriber_id]);
  }

  return { event_id: ev.event_id, duplicate, resolved_user_id: resolved, stub_created: stubCreated, attached_anonymous_events: attached };
}
