import { describe, expect, it } from "vitest";
import { assertNoPii, findPii, redactEmails, PiiLeakError } from "@/lib/pii/guard";

describe("redactEmails", () => {
  it("replaces every email in user text", () => {
    expect(redactEmails("look up Chloe.Reed603@yahoo.com and bob@x.org please")).toBe("look up [EMAIL] and [EMAIL] please");
    expect(redactEmails("how many went cold?")).toBe("how many went cold?");
  });
});

describe("findPii / assertNoPii", () => {
  it("passes clean aggregate output", () => {
    const out = { count: 229, ran: "source = instagram", sample_ids: ["sub_3fa9c2d1"], pages: [{ page: "/subscribe", count: 5 }] };
    expect(findPii(out)).toEqual([]);
    expect(assertNoPii(out)).toBe(out);
  });
  it("blocks emails anywhere in nested output", () => {
    expect(findPii({ rows: [{ id: 1, contact: "a@b.com" }] })).toEqual(["$.rows[0].contact: email pattern"]);
    expect(() => assertNoPii({ note: "mail me at a@b.co" })).toThrow(PiiLeakError);
  });
  it("blocks forbidden keys even when values look harmless", () => {
    expect(findPii({ email: "redacted", name: "x" })).toEqual(["$.email: forbidden key", "$.name: forbidden key"]);
  });
  it("does not false-positive on masked ids, paths or slugs", () => {
    expect(findPii({ id: "sub_3fa9c2d1", page: "/news/what-is-happening-in-sudan", story: "ai-regulation-bill", email_hash: "abc" })).toEqual([]);
  });
});
