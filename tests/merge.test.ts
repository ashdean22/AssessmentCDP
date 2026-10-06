import { describe, expect, it } from "vitest";
import {
  cleanAppUsers,
  cleanSubscribers,
  cleanWebEvents,
  dedupeSubscribers,
  stitchVisitors,
} from "@/lib/import/merge";

const sub = (o: Partial<Record<string, string>>) => ({
  email: "a@b.com",
  signup_date: "2026-08-01",
  status: "active",
  acquisition_source: "Instagram",
  last_open_date: "2026-09-01",
  ...o,
});

describe("cleanSubscribers", () => {
  it("rejects blank rows and invalid emails, keeps empty last_open as null", () => {
    const { clean, issues } = cleanSubscribers([
      sub({}),
      { email: "", signup_date: "", status: "", acquisition_source: "", last_open_date: "" },
      sub({ email: "not-an-email" }),
      sub({ email: "never@opened.com", last_open_date: "" }),
    ]);
    expect(clean).toHaveLength(2);
    expect(issues.map((i) => i.problem)).toEqual(["blank row", 'invalid email: "not-an-email"']);
    expect(clean[1].last_open_date).toBeNull();
  });
  it("logs but keeps a row with an unparseable date", () => {
    const { clean, issues } = cleanSubscribers([sub({ signup_date: "soon" })]);
    expect(clean).toHaveLength(1);
    expect(clean[0].signup_date).toBeNull();
    expect(issues[0].problem).toMatch(/unparseable signup_date/);
  });
});

describe("dedupeSubscribers", () => {
  it("merges case/space variants into one row", () => {
    const { clean } = cleanSubscribers([sub({}), sub({ email: " A@B.COM " })]);
    const merged = dedupeSubscribers(clean);
    expect(merged).toHaveLength(1);
    expect(merged[0].merged_count).toBe(2);
  });
  it("keeps earliest signup + its source, latest open, status of most recent row", () => {
    const { clean } = cleanSubscribers([
      sub({ signup_date: "2026-06-01", acquisition_source: "Podcast", last_open_date: "2026-07-01", status: "active" }),
      sub({ signup_date: "2026-08-01", acquisition_source: "Google", last_open_date: "2026-09-20", status: "unsubscribed" }),
    ]);
    const [m] = dedupeSubscribers(clean);
    expect(m.signup_date?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(m.source).toBe("podcast");
    expect(m.last_open_date?.toISOString().slice(0, 10)).toBe("2026-09-20");
    expect(m.status).toBe("unsubscribed");
  });
  it("a row with null open date never wins status over one that opened", () => {
    const { clean } = cleanSubscribers([
      sub({ last_open_date: "", status: "unsubscribed", signup_date: "2026-09-10" }),
      sub({ last_open_date: "2026-09-01", status: "active", signup_date: "2026-08-01" }),
    ]);
    expect(dedupeSubscribers(clean)[0].status).toBe("active");
  });
});

describe("cleanWebEvents + stitchVisitors", () => {
  const rows = [
    { visitor_id: "v1", page: "/", timestamp: "2026-06-30 20:11:42", utm_source: "instagram", email: "" },
    { visitor_id: "v1", page: "/subscribe", timestamp: "2026-06-30 20:15:00", utm_source: "", email: "Zoe@X.com" },
    { visitor_id: "v2", page: "/about", timestamp: "2026-07-01 09:00:00", utm_source: "", email: "" },
    { visitor_id: "v1", page: "/", timestamp: "2026-06-30 20:11:42", utm_source: "instagram", email: "" },
  ];
  it("normalizes, drops exact duplicates, nulls empty utm", () => {
    const { clean, issues } = cleanWebEvents(rows);
    expect(clean).toHaveLength(3);
    expect(issues[0].problem).toBe("exact duplicate event");
    expect(clean[1].email).toBe("zoe@x.com");
    expect(clean[1].utm_source).toBeNull();
  });
  it("stitches every visit of a visitor that ever gave a known email", () => {
    const { clean } = cleanWebEvents(rows);
    const map = stitchVisitors(clean, new Set(["zoe@x.com"]));
    expect(map.get("v1")).toBe("zoe@x.com");
    expect(map.has("v2")).toBe(false);
  });
  it("does not link an email that is not a subscriber", () => {
    const { clean } = cleanWebEvents(rows);
    expect(stitchVisitors(clean, new Set()).size).toBe(0);
  });
});

describe("cleanAppUsers", () => {
  it("normalizes email and rejects duplicate user_ids", () => {
    const { clean, issues } = cleanAppUsers([
      { user_id: "u_1", email: "Julia@Gmail.com", created_at: "2026-08-22" },
      { user_id: "u_1", email: "x@y.com", created_at: "2026-08-23" },
      { user_id: "", email: "x@y.com", created_at: "2026-08-23" },
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0].email).toBe("julia@gmail.com");
    expect(issues.map((i) => i.problem)).toEqual(["duplicate user_id: u_1", "missing user_id"]);
  });
});
