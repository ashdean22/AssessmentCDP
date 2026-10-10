import { describe, expect, it } from "vitest";
import { explainFilter, namedSegment } from "@/lib/segments/explain";

describe("plain-English segment summary", () => {
  it("reads the brief's example segment", () => {
    expect(explainFilter({ op: "AND", rules: [{ field: "source", cmp: "is", value: "instagram" }, { field: "days_since_open", cmp: "gt", value: 30 }] }))
      .toBe("Readers who signed up from instagram and haven't opened the newsletter in over 30 days.");
  });
  it("nests OR groups in parentheses and handles empty filters", () => {
    expect(explainFilter({ op: "AND", rules: [{ field: "has_app", cmp: "yes" }, { op: "OR", rules: [{ field: "churn_tier", cmp: "is", value: "at_risk" }, { field: "churn_tier", cmp: "is", value: "cold" }] }] }))
      .toBe("Readers who have the app and (are At risk or are Cold).");
    expect(explainFilter({ op: "AND", rules: [] })).toBe("Every reader (no rules yet).");
  });
  it("names well-known segments", () => {
    expect(namedSegment({ op: "AND", rules: [{ field: "churn_tier", cmp: "is", value: "at_risk" }] })).toMatch(/At-risk/);
    expect(namedSegment({ op: "AND", rules: [{ field: "days_since_open", cmp: "between", value: [31, 60] }] })).toBe("Went cold last month.");
    expect(namedSegment({ op: "AND", rules: [{ field: "has_app", cmp: "yes" }] })).toBeNull();
  });
});
