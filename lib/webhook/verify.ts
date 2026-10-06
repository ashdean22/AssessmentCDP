import { createHmac, timingSafeEqual } from "node:crypto";
import { WEBHOOK_MAX_AGE_SECONDS } from "@/lib/config";

/**
 * Request signing for POST /webhooks/app.
 *
 *   X-TPO-Timestamp: <unix seconds>
 *   X-TPO-Signature: hex( HMAC-SHA256( secret, `${timestamp}.${rawBody}` ) )
 *
 * Binding the timestamp into the signature stops replaying an old capture
 * with a fresh timestamp; the 5-minute window stops replaying it as-is.
 */
export const SIG_HEADER = "x-tpo-signature";
export const TS_HEADER = "x-tpo-timestamp";
export const MAX_BODY_BYTES = 64 * 1024;

export function signPayload(secret: string, timestamp: string | number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function verifySignature(
  opts: { secret: string; timestamp: string | null; signature: string | null; rawBody: string; nowSeconds?: number },
): VerifyResult {
  const { secret, timestamp, signature, rawBody } = opts;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!timestamp || !signature) return { ok: false, reason: "missing signature headers" };
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "bad timestamp" };
  const age = now - Number(timestamp);
  if (Math.abs(age) > WEBHOOK_MAX_AGE_SECONDS) return { ok: false, reason: "timestamp outside allowed window" };

  const expected = signPayload(secret, timestamp, rawBody);
  const a = Buffer.from(signature.toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}
