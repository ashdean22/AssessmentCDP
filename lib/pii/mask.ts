import { createHmac } from "node:crypto";

/**
 * Stable, unreadable identifier for a subscriber. The AI only ever sees these.
 * HMAC (not plain SHA-256) so nobody can brute-force a known email list
 * against the hashes without MASK_SECRET.
 */
export function emailHash(normalizedEmail: string, secret = process.env.MASK_SECRET): string {
  if (!secret) throw new Error("MASK_SECRET is not set");
  return createHmac("sha256", secret).update(normalizedEmail).digest("hex");
}

/** `sub_` + first 8 hex chars of the HMAC — the id shown to the model. */
export function maskedId(hash: string): string {
  return `sub_${hash.slice(0, 8)}`;
}
