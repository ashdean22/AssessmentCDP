import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/segments/compile";

describe("compileFilter", () => {
  it("compiles the canonical Instagram-gone-cold filter with parameters only", () => {
    const c = compileFilter({
      op: "AND",
      rules: [
        { field: "source", cmp: "is", value: "instagram" },
        { field: "days_since_open", cmp: "gt", value: 30 },
      ],
    });
    expect(c.where).toBe(
      "(s.source = ($1->>'p0')::text and (s.last_open_date is null or (reference_date() - s.last_open_date) > ($1->>'p1')::int))",
    );
    expect(c.params).toEqual({ p0: "instagram", p1: 30 });
    expect(c.where).not.toContain("instagram"); // values never enter the SQL text
    expect(c.description).toBe("source = instagram AND last open more than 30 days ago (or never)");
  });

  it("nests AND / OR groups", () => {
    const c = compileFilter({
      op: "OR",
      rules: [
        { field: "status", cmp: "is", value: "unsubscribed" },
        {
          op: "AND",
          rules: [
            { field: "has_app", cmp: "yes" },
            { field: "engagement_score", cmp: "between", value: [40, 69] },
          ],
        },
      ],
    });
    expect(c.where).toMatch(/^\(s\.status = .* or \(exists .* and s\.engagement_score between .*\)\)$/);
    expect(Object.keys(c.params)).toEqual(["p0", "p1", "p2"]);
  });

  it("rejects unknown fields, comparisons and bad values", () => {
    expect(() => compileFilter({ op: "AND", rules: [{ field: "email", cmp: "is", value: "x" }] })).toThrow();
    expect(() => compileFilter({ op: "AND", rules: [{ field: "source", cmp: "like", value: "x" }] })).toThrow();
    expect(() => compileFilter({ op: "AND", rules: [{ field: "source", cmp: "is", value: "myspace" }] })).toThrow();
    expect(() => compileFilter({ op: "AND", rules: [{ field: "visited_page", cmp: "has", value: "'; drop table subscribers; --" }] })).toThrow();
    expect(() => compileFilter({ op: "XOR", rules: [] })).toThrow();
    expect(() => compileFilter("select *")).toThrow();
  });

  it("handles array operators and empty groups", () => {
    const c = compileFilter({ op: "AND", rules: [{ field: "source", cmp: "in", value: ["instagram", "facebook"] }] });
    expect(c.where).toContain("jsonb_array_elements_text($1->'p0')");
    expect(c.params.p0).toEqual(["instagram", "facebook"]);
    expect(compileFilter({ op: "AND", rules: [] }).where).toBe("true");
  });

  it("applies default windows", () => {
    const c = compileFilter({ op: "AND", rules: [{ field: "web_visits", cmp: "gt", value: 5 }] });
    expect(c.params).toEqual({ p0: 30, p1: 5 });
    expect(c.description).toBe("more than 5 web visits in last 30 days");
  });
});
