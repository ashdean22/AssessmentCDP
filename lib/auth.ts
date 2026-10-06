import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed session for the single shared dashboard password.
 * Token = base64url(expiresAtMs) + "." + HMAC-SHA256(expiresAt, SESSION_SECRET).
 * Nothing secret is stored in the cookie; tampering breaks the signature.
 */
export const SESSION_COOKIE = "tpo_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now + SESSION_TTL_MS);
  const payload = Buffer.from(String(expiresAt.getTime())).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(Buffer.from(payload, "base64url").toString());
  return Number.isFinite(exp) && exp > now;
}

/** Constant-time password check so timing doesn't leak prefix matches. */
export function checkPassword(candidate: string): boolean {
  const real = process.env.APP_PASSWORD;
  if (!real) throw new Error("APP_PASSWORD is not set");
  const a = Buffer.from(candidate), b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
