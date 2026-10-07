import { describe, expect, it } from "vitest";
import { emailPrefix } from "@/lib/search";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { WINBACK_SYSTEM } from "@/lib/winback";
import { TONE_GUIDE } from "@/lib/tone";

describe("email prefix suggestions", () => {
  it("normalizes like the search page and escapes LIKE wildcards", () => {
    expect(emailPrefix("  Ann.")).toBe("ann.");
    expect(emailPrefix("a%_b\\")).toBe("a\\%\\_b\\\\");
  });
  it("refuses prefixes that are too short, empty or absurdly long", () => {
    expect(emailPrefix("a")).toBeNull();
    expect(emailPrefix("   ")).toBeNull();
    expect(emailPrefix(null)).toBeNull();
    expect(emailPrefix("x".repeat(121))).toBeNull();
  });
});

describe("tone guide is shared by every AI surface", () => {
  it("chat and win-back prompts embed the single tone guide", () => {
    expect(SYSTEM_PROMPT).toContain(TONE_GUIDE);
    expect(WINBACK_SYSTEM).toContain(TONE_GUIDE);
  });
});

describe("subscriber list params", () => {
  it("accepts only allowlisted values and sane pages", async () => {
    const { parseListParams } = await import("@/lib/subscribers-list");
    expect(parseListParams({ tier: "at_risk", status: "nope", source: "instagram", sort: "score", page: "3", q: "Emi" }))
      .toEqual({ page: 3, sort: "score", tier: "at_risk", status: "", source: "instagram", q: "Emi" });
    expect(parseListParams(new URLSearchParams("page=-4&sort=drop%20table"))).toMatchObject({ page: 1, sort: "last_open" });
  });
});
