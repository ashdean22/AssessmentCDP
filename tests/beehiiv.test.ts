import { describe, expect, it } from "vitest";
import { buildBeehiivPush, campaignSlug, maskKey, subscriptionBody } from "@/lib/beehiiv";

const rows = [
  { email: "ann@example.com", source: "instagram", churn_tier: "at_risk", engagement_score: 22 },
  { email: "bob@example.com", source: "google", churn_tier: null, engagement_score: null },
  { email: "cy@example.com", source: "direct", churn_tier: "cold", engagement_score: 3 },
  { email: "di@example.com", source: "podcast", churn_tier: "cooling", engagement_score: 55 },
];

describe("beehiiv mock push", () => {
  it("targets the documented per-subscriber create endpoint and never sends the real key", () => {
    const plan = buildBeehiivPush({ segmentName: "At risk readers", rows, publicationId: "pub_123", apiKey: "bh_secret_key_value" });
    expect(plan.mode).toBe("mock");
    expect(plan.method).toBe("POST");
    expect(plan.url).toBe("https://api.beehiiv.com/v2/publications/pub_123/subscriptions");
    expect(plan.total_requests).toBe(4);
    expect(plan.sample).toHaveLength(3);
    expect(JSON.stringify(plan)).not.toContain("bh_secret_key_value");
    expect(plan.headers.Authorization).toBe("Bearer bh_s••••");
    expect(maskKey(undefined)).toMatch(/not set/);
  });
  it("builds one request body per subscriber with segment custom fields", () => {
    const b = subscriptionBody(rows[1], "At risk readers");
    expect(b).toEqual({
      email: "bob@example.com", reactivate_existing: false, send_welcome_email: false,
      utm_source: "google", utm_medium: "tpo-cdp", utm_campaign: "at-risk-readers",
      custom_fields: [{ name: "tpo_segment", value: "At risk readers" }, { name: "churn_tier", value: "" }, { name: "engagement_score", value: "" }],
    });
    expect(campaignSlug("  Weird!! Name ")).toBe("weird-name");
    expect(campaignSlug("!!!")).toBe("segment");
  });
  it("falls back to a placeholder publication id and handles empty segments", () => {
    const plan = buildBeehiivPush({ segmentName: "x", rows: [] });
    expect(plan.url).toContain("pub_00000000");
    expect(plan.total_requests).toBe(0);
    expect(plan.sample).toEqual([]);
  });
});
