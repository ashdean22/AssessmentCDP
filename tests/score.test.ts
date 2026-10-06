import { describe, expect, it } from "vitest";
import { churnTier, engagementScore, recencyPoints } from "@/lib/score";
import { REFERENCE_DATE, DAY_MS } from "@/lib/config";

const ago = (d: number) => new Date(REFERENCE_DATE.getTime() - d * DAY_MS);

describe("recencyPoints", () => {
  it("steps at 7 / 30 / 60 days from REFERENCE_DATE", () => {
    expect(recencyPoints(ago(0))).toBe(40);
    expect(recencyPoints(ago(7))).toBe(40);
    expect(recencyPoints(ago(8))).toBe(25);
    expect(recencyPoints(ago(30))).toBe(25);
    expect(recencyPoints(ago(31))).toBe(10);
    expect(recencyPoints(ago(60))).toBe(10);
    expect(recencyPoints(ago(61))).toBe(0);
    expect(recencyPoints(null)).toBe(0);
  });
});

describe("engagementScore", () => {
  it("caps web and app at 30 each", () => {
    const s = engagementScore({ lastOpenDate: ago(1), webVisitsLast30d: 20, appEventsLast30d: 50 });
    expect(s).toEqual({ recency: 40, web: 30, app: 30, total: 100 });
  });
  it("adds partial points", () => {
    const s = engagementScore({ lastOpenDate: ago(20), webVisitsLast30d: 2, appEventsLast30d: 3 });
    expect(s.total).toBe(25 + 10 + 9);
  });
});

describe("churnTier", () => {
  it("maps thresholds", () => {
    expect(churnTier(70)).toBe("active");
    expect(churnTier(69)).toBe("cooling");
    expect(churnTier(40)).toBe("cooling");
    expect(churnTier(39)).toBe("at_risk");
    expect(churnTier(15)).toBe("at_risk");
    expect(churnTier(14)).toBe("cold");
    expect(churnTier(0)).toBe("cold");
  });
});
