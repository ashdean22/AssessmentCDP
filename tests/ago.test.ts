import { describe, expect, it } from "vitest";
import { ago } from "@/lib/ago";

const t0 = Date.parse("2026-10-12T20:00:00Z");
const at = (secs: number) => new Date(t0 - secs * 1000).toISOString();

describe("ago", () => {
  it("formats arrival age in coarse steps", () => {
    expect(ago(at(2), t0)).toBe("just now");
    expect(ago(at(12), t0)).toBe("12s ago");
    expect(ago(at(180), t0)).toBe("3m ago");
    expect(ago(at(7200), t0)).toBe("2h ago");
    expect(ago(at(3 * 86400), t0)).toBe("3d ago");
  });
  it("never goes negative when clocks disagree", () => {
    expect(ago(at(-30), t0)).toBe("just now");
  });
});
