import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeSource,
  normalizeStatus,
  parseDateUTC,
} from "@/lib/normalize";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Chloe.Reed603@Yahoo.Com ")).toBe("chloe.reed603@yahoo.com");
  });
  it("rejects invalid, empty and null", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("two@@at.com")).toBeNull();
  });
  it("keeps plus aliases as distinct addresses (documented edge case)", () => {
    expect(normalizeEmail("name+tpo@gmail.com")).toBe("name+tpo@gmail.com");
  });
});

describe("parseDateUTC", () => {
  it("parses date-only as UTC midnight", () => {
    expect(parseDateUTC("2026-09-11")?.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });
  it("parses zone-less datetime as UTC", () => {
    expect(parseDateUTC("2026-06-30 20:11:42")?.toISOString()).toBe("2026-06-30T20:11:42.000Z");
  });
  it("parses full ISO with Z", () => {
    expect(parseDateUTC("2026-09-28T14:22:05Z")?.toISOString()).toBe("2026-09-28T14:22:05.000Z");
  });
  it("returns null for garbage and empty", () => {
    expect(parseDateUTC("")).toBeNull();
    expect(parseDateUTC("yesterday")).toBeNull();
    expect(parseDateUTC("2026-13-45")).toBeNull();
    expect(parseDateUTC("09/11/2026")).toBeNull();
  });
});

describe("normalizeSource", () => {
  it("maps variants to canonical values", () => {
    expect(normalizeSource("Instagram")).toBe("instagram");
    expect(normalizeSource("IG")).toBe("instagram");
    expect(normalizeSource("insta")).toBe("instagram");
    expect(normalizeSource("X")).toBe("twitter");
    expect(normalizeSource("twitter")).toBe("twitter");
    expect(normalizeSource("Referral")).toBe("referral");
  });
  it("unknown → other, empty → null", () => {
    expect(normalizeSource("tiktok")).toBe("other");
    expect(normalizeSource("")).toBeNull();
    expect(normalizeSource(undefined)).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("maps to the fixed list", () => {
    expect(normalizeStatus("Active")).toBe("active");
    expect(normalizeStatus(" unsubscribed ")).toBe("unsubscribed");
    expect(normalizeStatus("bogus")).toBeNull();
    expect(normalizeStatus("")).toBeNull();
  });
});
