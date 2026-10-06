import { describe, expect, it } from "vitest";
import { findPii } from "@/lib/pii/guard";
import { segmentStats, winbackPrompt } from "@/lib/winback";

// Reference date is 2026-09-28.
const rows = [
  { email: "ann@example.com", status: "active", source: "instagram", signup_date: "2026-01-01", last_open_date: "2026-08-19", engagement_score: 20, churn_tier: "at_risk" },
  { email: "bob@example.com", status: "active", source: "instagram", signup_date: "2026-06-01", last_open_date: "2026-08-29", engagement_score: 30, churn_tier: "at_risk" },
  { email: "cy@example.com", status: "unsubscribed", source: "google", signup_date: "2025-09-28", last_open_date: null, engagement_score: 16, churn_tier: "at_risk" },
  { email: "di@example.com", status: "active", source: "podcast", signup_date: null, last_open_date: "2026-07-30", engagement_score: null, churn_tier: null },
];

describe("win-back segment stats", () => {
  const stats = segmentStats(rows, "At risk readers");

  it("aggregates without any PII and passes the guard", () => {
    expect(findPii(stats)).toEqual([]);
    expect(JSON.stringify(stats)).not.toMatch(/@/);
    expect(findPii({ prompt: winbackPrompt(stats) })).toEqual([]);
  });
  it("computes mixes, averages and day quantiles from the reference date", () => {
    expect(stats.count).toBe(4);
    expect(stats.source_mix_pct).toEqual({ instagram: 50, google: 25, podcast: 25 });
    expect(stats.status_mix_pct).toEqual({ active: 75, unsubscribed: 25 });
    expect(stats.tier_mix_pct).toEqual({ at_risk: 75, unscored: 25 });
    expect(stats.avg_engagement_score).toBe(22);
    // opens: 40d, 30d, 60d ago → sorted [30, 40, 60]; one never
    expect(stats.days_since_last_open).toEqual({ never_pct: 25, median: 40, p25: 30, p75: 40 });
    expect(stats.days_since_signup.median).toBe(270);
    expect(stats.reference_date).toBe("2026-09-28");
  });
  it("handles an empty segment", () => {
    const s = segmentStats([], "empty");
    expect(s.count).toBe(0);
    expect(s.avg_engagement_score).toBeNull();
    expect(s.days_since_last_open).toEqual({ never_pct: 0, median: null, p25: null, p75: null });
  });
});
