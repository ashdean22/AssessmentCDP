import { describe, expect, it } from "vitest";
import { emailHash, maskedId } from "@/lib/pii/mask";

describe("emailHash / maskedId", () => {
  it("is stable for the same input and secret", () => {
    expect(emailHash("a@b.com", "s1")).toBe(emailHash("a@b.com", "s1"));
  });
  it("changes with the secret, so hashes can't be matched without it", () => {
    expect(emailHash("a@b.com", "s1")).not.toBe(emailHash("a@b.com", "s2"));
  });
  it("masked id is sub_ + 8 hex chars and contains no part of the email", () => {
    const id = maskedId(emailHash("chloe.reed603@yahoo.com", "s1"));
    expect(id).toMatch(/^sub_[0-9a-f]{8}$/);
    expect(id).not.toContain("chloe");
  });
});
