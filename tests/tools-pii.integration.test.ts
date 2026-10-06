/**
 * Proof for the brief: run every AI tool against the real database and fail
 * if any output contains an email or a forbidden key. Skipped without DB env.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, expect, it } from "vitest";
import { EMAIL_RE, findPii } from "@/lib/pii/guard";

const live = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.MASK_SECRET;
const d = live ? describe : describe.skip;

d("AI tools never leak PII (integration)", async () => {
  const { runTool } = await import("@/lib/ai/tools");
  const cases: [string, unknown][] = [
    ["count_segment", { filter: { op: "AND", rules: [{ field: "source", cmp: "is", value: "instagram" }, { field: "days_since_open", cmp: "between", value: [31, 60] }] } }],
    ["build_segment", { name: "test", filter: { op: "AND", rules: [{ field: "engagement_score", cmp: "gt", value: 69 }] } }],
    ["top_engaged", { limit: 25 }],
    ["source_quality", {}],
    ["first_pages", { new_within_days: 30, limit: 10 }],
    ["app_newsletter_overlap", {}],
    ["trend", { metric: "signups", bucket: "week", periods: 12 }],
    ["get_definitions", {}],
  ];

  for (const [name, input] of cases) {
    it(`${name} output is clean`, async () => {
      const out = await runTool(name, input);
      const text = JSON.stringify(out);
      expect(text).not.toMatch(EMAIL_RE);
      expect(findPii(out)).toEqual([]);
    }, 30000);
  }
});
