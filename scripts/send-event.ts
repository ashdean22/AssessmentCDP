/**
 * Signs and sends test events to the webhook.
 *
 *   npx tsx scripts/send-event.ts [scenario] [--url https://host]
 *
 * Scenarios: normal · duplicate · out-of-order · anon-then-login · unknown-user
 *            · bad-signature · bad-body · all (default)
 * URL defaults to http://localhost:3000; WEBHOOK_SECRET comes from .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { randomBytes } from "node:crypto";
import { signPayload, SIG_HEADER, TS_HEADER } from "@/lib/webhook/verify";

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const BASE = urlIdx >= 0 ? args[urlIdx + 1] : "http://localhost:3000";
const scenario = args.find((a) => !a.startsWith("--") && a !== BASE) ?? "all";
const SECRET = process.env.WEBHOOK_SECRET;
if (!SECRET) throw new Error("WEBHOOK_SECRET missing");

const rid = () => randomBytes(3).toString("hex");
const stamp = (iso: string) => iso; // events use the brief's "today", 2026-09-28

async function send(label: string, body: object, opts: { badSig?: boolean; rawBody?: string } = {}) {
  const raw = opts.rawBody ?? JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = opts.badSig ? "0".repeat(64) : signPayload(SECRET!, ts, raw);
  const res = await fetch(`${BASE}/webhooks/app`, {
    method: "POST",
    headers: { "content-type": "application/json", [TS_HEADER]: ts, [SIG_HEADER]: sig },
    body: raw,
  });
  const text = await res.text();
  console.log(`\n▶ ${label}\n  ${res.status} ${text.slice(0, 220)}`);
  return res;
}

const base = (over: Partial<Record<string, unknown>>) => ({
  event_id: `evt_${rid()}`,
  event: "app_open",
  user_id: null,
  device_id: `d_${rid()}`,
  timestamp: stamp("2026-09-28T14:22:05Z"),
  properties: {},
  ...over,
});

const scenarios: Record<string, () => Promise<void>> = {
  async normal() {
    // u_2b6447a3 is a real app user from app_users.csv
    await send("normal read_story for a known user", base({
      event: "read_story", user_id: "u_2b6447a3", device_id: "d_4b21e8",
      properties: { story: "supreme-court-ruling-explained" },
    }));
  },
  async duplicate() {
    const ev = base({ event: "link_click", user_id: "u_2b6447a3", device_id: "d_4b21e8", properties: { url: "https://thepourover.org/podcast" } });
    await send("first delivery", ev);
    await send("same event_id again (expect duplicate: true)", ev);
  },
  async "out-of-order"() {
    const device = `d_${rid()}`;
    await send("later event arrives first (15:00)", base({ event: "app_open", user_id: "u_baba14aa", device_id: device, timestamp: "2026-09-28T15:00:00Z" }));
    await send("earlier event arrives second (14:00)", base({ event: "read_story", user_id: "u_baba14aa", device_id: device, timestamp: "2026-09-28T14:00:00Z", properties: { story: "federal-budget-standoff" } }));
    console.log("  → lookup shows them sorted by event time, not arrival");
  },
  async "anon-then-login"() {
    const device = `d_${rid()}`;
    const user = `u_${rid()}${rid()}`.slice(0, 11);
    await send("anonymous app_open", base({ device_id: device, timestamp: "2026-09-28T09:00:00Z" }));
    await send("anonymous read_story", base({ event: "read_story", device_id: device, timestamp: "2026-09-28T09:05:00Z", properties: { story: "ai-regulation-bill" } }));
    await send(`login as ${user} (expect attached_anonymous_events: 2)`, base({ event: "login", user_id: user, device_id: device, timestamp: "2026-09-28T09:10:00Z" }));
    await send("anonymous event after login on same device (expect resolved_user_id set)", base({ device_id: device, timestamp: "2026-09-28T09:15:00Z" }));
  },
  async "unknown-user"() {
    await send("never-seen user_id (expect stub_created: true)", base({ event: "login", user_id: `u_new${rid()}`, device_id: `d_${rid()}` }));
  },
  async "bad-signature"() {
    await send("wrong signature (expect 401)", base({}), { badSig: true });
  },
  async "bad-body"() {
    await send("unknown event type (expect 400)", base({ event: "purchase" }));
    await send("story slug with spaces/caps (expect 400)", base({ event: "read_story", properties: { story: "Not A Slug!" } }));
    await send("malformed JSON (expect 400)", {}, { rawBody: "{not json" });
  },
};

(async () => {
  const run = scenario === "all" ? Object.keys(scenarios) : [scenario];
  for (const s of run) {
    if (!scenarios[s]) { console.error(`unknown scenario ${s}`); process.exit(1); }
    console.log(`\n=== ${s} ===`);
    await scenarios[s]();
  }
})();
