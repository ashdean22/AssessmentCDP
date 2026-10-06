/**
 * Runs against the real database when SUPABASE_URL is set (locally via
 * .env.local). Skipped in CI, where there are no secrets. Uses throwaway
 * ids prefixed `itest_` and cleans up after itself.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { afterAll, describe, expect, it } from "vitest";

const live = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const d = live ? describe : describe.skip;

d("ingestAppEvent (integration)", async () => {
  const { ingestAppEvent } = await import("@/lib/webhook/ingest");
  const { db } = await import("@/lib/db");
  const run = Date.now().toString(36);
  const device = `itest_d_${run}`;
  const user = `itest_u_${run}`;
  const ev = (over: Record<string, unknown>) => ({
    event_id: `itest_evt_${run}_${Math.random().toString(36).slice(2, 8)}`,
    event: "app_open" as const,
    user_id: null as string | null,
    device_id: device,
    timestamp: "2026-09-28T10:00:00Z",
    properties: {},
    ...over,
  });

  afterAll(async () => {
    const s = db();
    await s.from("app_events").delete().like("event_id", `itest_evt_${run}%`);
    await s.from("devices").delete().eq("device_id", device);
    await s.from("app_users").delete().eq("user_id", user);
  });

  it("duplicate event_id is a no-op", async () => {
    const e = ev({});
    const a = await ingestAppEvent(e);
    const b = await ingestAppEvent(e);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });

  it("anonymous events attach on login; later anonymous events resolve via device; unknown user gets a stub", async () => {
    await ingestAppEvent(ev({ timestamp: "2026-09-28T10:05:00Z" }));
    const login = await ingestAppEvent(ev({ event: "login", user_id: user, timestamp: "2026-09-28T10:10:00Z" }));
    expect(login.stub_created).toBe(true);
    expect(login.attached_anonymous_events).toBeGreaterThanOrEqual(2); // the two anonymous events above
    const after = await ingestAppEvent(ev({ timestamp: "2026-09-28T10:15:00Z" }));
    expect(after.resolved_user_id).toBe(user);

    const { data } = await db().from("app_events").select("resolved_user_id").like("event_id", `itest_evt_${run}%`);
    expect(data!.every((r) => r.resolved_user_id === user)).toBe(true);
  });

  it("out-of-order arrival still sorts by event time", async () => {
    await ingestAppEvent(ev({ user_id: user, timestamp: "2026-09-28T12:00:00Z", event: "read_story", properties: { story: "b" } }));
    await ingestAppEvent(ev({ user_id: user, timestamp: "2026-09-28T11:00:00Z", event: "read_story", properties: { story: "a" } }));
    const { data } = await db()
      .from("app_events")
      .select("ts,properties")
      .eq("resolved_user_id", user)
      .eq("event", "read_story")
      .order("ts", { ascending: true });
    expect(data!.map((r) => (r.properties as { story: string }).story)).toEqual(["a", "b"]);
  });
});
