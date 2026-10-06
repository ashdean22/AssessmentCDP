import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "@/lib/webhook/verify";
import { AppEventSchema } from "@/lib/webhook/schema";

const secret = "whsec_test";
const body = JSON.stringify({ event_id: "evt_1" });

describe("verifySignature", () => {
  it("accepts a fresh, correctly signed request", () => {
    const ts = "1700000000";
    const r = verifySignature({ secret, timestamp: ts, signature: signPayload(secret, ts, body), rawBody: body, nowSeconds: 1700000010 });
    expect(r).toEqual({ ok: true });
  });
  it("rejects missing headers, wrong secret, tampered body", () => {
    const ts = "1700000000";
    expect(verifySignature({ secret, timestamp: null, signature: null, rawBody: body, nowSeconds: 1700000000 }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: signPayload("other", ts, body), rawBody: body, nowSeconds: 1700000000 }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: signPayload(secret, ts, body), rawBody: body + " ", nowSeconds: 1700000000 }).ok).toBe(false);
  });
  it("rejects replays outside the 5-minute window, and timestamp swaps", () => {
    const ts = "1700000000";
    const sig = signPayload(secret, ts, body);
    expect(verifySignature({ secret, timestamp: ts, signature: sig, rawBody: body, nowSeconds: 1700000000 + 301 }).ok).toBe(false);
    expect(verifySignature({ secret, timestamp: ts, signature: sig, rawBody: body, nowSeconds: 1700000000 + 299 }).ok).toBe(true);
    // Reusing the old signature with a fresh timestamp fails because ts is signed.
    expect(verifySignature({ secret, timestamp: "1700000200", signature: sig, rawBody: body, nowSeconds: 1700000200 }).ok).toBe(false);
  });
});

describe("AppEventSchema", () => {
  const good = {
    event_id: "evt_9f3a1c", event: "read_story", user_id: "u_2b6447a3", device_id: "d_4b21e8",
    timestamp: "2026-09-28T14:22:05Z", properties: { story: "supreme-court-ruling-explained" },
  };
  it("accepts the brief's example and null user_id", () => {
    expect(AppEventSchema.safeParse(good).success).toBe(true);
    expect(AppEventSchema.safeParse({ ...good, user_id: null }).success).toBe(true);
    expect(AppEventSchema.safeParse({ ...good, properties: undefined }).success).toBe(true);
  });
  it("rejects unknown event types, bad slugs, bad timestamps, extra keys", () => {
    expect(AppEventSchema.safeParse({ ...good, event: "purchase" }).success).toBe(false);
    expect(AppEventSchema.safeParse({ ...good, properties: { story: "Not A Slug" } }).success).toBe(false);
    expect(AppEventSchema.safeParse({ ...good, timestamp: "yesterday" }).success).toBe(false);
    expect(AppEventSchema.safeParse({ ...good, admin: true }).success).toBe(false);
    expect(AppEventSchema.safeParse({ ...good, device_id: "d 1; drop" }).success).toBe(false);
  });
});
