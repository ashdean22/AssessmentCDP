import { beforeAll, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken, SESSION_TTL_MS } from "@/lib/auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret";
  process.env.APP_PASSWORD = "correct horse";
});

describe("session tokens", () => {
  it("round-trips", () => {
    const { token } = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });
  it("rejects tampered, malformed and missing tokens", () => {
    const { token } = createSessionToken();
    expect(verifySessionToken(token.slice(0, -1) + "x")).toBe(false);
    expect(verifySessionToken("nope")).toBe(false);
    expect(verifySessionToken(undefined)).toBe(false);
  });
  it("expires", () => {
    const { token } = createSessionToken(0);
    expect(verifySessionToken(token, SESSION_TTL_MS + 1)).toBe(false);
    expect(verifySessionToken(token, SESSION_TTL_MS - 1)).toBe(true);
  });
});

describe("checkPassword", () => {
  it("matches exactly", () => {
    expect(checkPassword("correct horse")).toBe(true);
    expect(checkPassword("correct hors")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });
});
