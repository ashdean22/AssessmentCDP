import { TIER_LABEL, type ChurnTier } from "@/lib/score";
import type { Filter, Group, Rule } from "./fields";

/**
 * Plain-English reading of a filter, for the segment builder's live summary
 * and the save confirmation. Pure: no DB, safe in the browser.
 */
const isGroup = (n: Rule | Group): n is Group => (n as Group).op !== undefined;
const list = (v: string | string[]) => (Array.isArray(v) ? v.join(" or ") : v);
const tier = (v: string) => TIER_LABEL[v as ChurnTier] ?? v;

export function explainRule(r: Rule): string {
  switch (r.field) {
    case "source":
      return r.cmp === "is_not" ? `didn't sign up from ${r.value}` : `signed up from ${list(r.value)}`;
    case "status":
      return r.cmp === "is" ? `are ${r.value === "active" ? "still subscribed" : "unsubscribed"}` : `are not ${r.value}`;
    case "signup_date":
      if (r.cmp === "in_last_days") return `signed up in the last ${r.value} days`;
      return `signed up ${r.cmp} ${r.value}`;
    case "days_since_open":
      if (r.cmp === "never") return "have never opened the newsletter";
      if (r.cmp === "between" && Array.isArray(r.value)) return `last opened the newsletter ${r.value[0]} to ${r.value[1]} days ago`;
      return r.cmp === "gt" ? `haven't opened the newsletter in over ${r.value} days` : `opened the newsletter in the last ${r.value} days`;
    case "visited_page":
      if (r.cmp === "has_not") return `never visited ${r.value}`;
      if (r.cmp === "at_least") return `visited ${r.value} at least ${r.times ?? 1} times`;
      return `visited ${r.value}`;
    case "utm_source":
      return `came to the website from a ${list(r.value)} link`;
    case "web_visits":
      return `made ${r.cmp === "gt" ? "more than" : "fewer than"} ${r.value} website visits in the last ${r.days} days`;
    case "has_app":
      return r.cmp === "yes" ? "have the app" : "don't have the app";
    case "app_events":
      return `had ${r.cmp === "gt" ? "more than" : "fewer than"} ${r.value} ${r.event ? `${r.event} events` : "app events"} in the last ${r.days} days`;
    case "last_app_activity":
      return r.cmp === "within" ? `used the app in the last ${r.value} days` : `haven't used the app in over ${r.value} days`;
    case "engagement_score":
      if (Array.isArray(r.value)) return `have an engagement score between ${r.value[0]} and ${r.value[1]}`;
      return `have an engagement score ${r.cmp === "gt" ? "above" : "below"} ${r.value}`;
    case "churn_tier":
      return r.cmp === "is" ? `are ${tier(r.value)}` : `are not ${tier(r.value)}`;
  }
}

function explainGroup(g: Group, top: boolean): string {
  const parts = g.rules.map((n) => (isGroup(n) ? explainGroup(n, false) : explainRule(n))).filter(Boolean);
  if (!parts.length) return "";
  const joined = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + (g.op === "AND" ? " and " : " or ") + parts.at(-1);
  return top || parts.length === 1 ? joined : `(${joined})`;
}

/** "Readers who signed up from instagram and last opened the newsletter 31 to 60 days ago." */
export function explainFilter(f: Filter): string {
  const body = explainGroup(f, true);
  return body ? `Readers who ${body}.` : "Every reader (no rules yet).";
}

/** Known named groups this filter matches exactly, for a friendly label. */
export function namedSegment(f: Filter): string | null {
  if (f.rules.length !== 1 || isGroup(f.rules[0])) return null;
  const r = f.rules[0];
  if (r.field === "churn_tier" && r.cmp === "is") {
    const why: Record<string, string> = {
      active: "Active readers (score 70+): opening, visiting and using the app.",
      cooling: "Cooling readers (score 40–69): still around, but less than before.",
      at_risk: "At-risk readers (score 15–39): drifting away; good win-back targets.",
      cold: "Cold readers (score under 15): little or no recent activity.",
    };
    return why[r.value] ?? null;
  }
  if (r.field === "days_since_open" && r.cmp === "between" && Array.isArray(r.value) && r.value[0] === 31 && r.value[1] === 60) return "Went cold last month.";
  if (r.field === "engagement_score" && r.cmp === "gt" && r.value === 69) return "Engaged readers (score 70+).";
  return null;
}
