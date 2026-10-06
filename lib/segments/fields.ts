import { z } from "zod";
import { SOURCES, STATUSES } from "@/lib/normalize";
import { APP_EVENT_TYPES } from "@/lib/config";
import { CHURN_TIERS } from "@/lib/score";

/**
 * The allowlist. Every rule the UI or the AI can express is one of these
 * field+comparison pairs. The compiler refuses anything else.
 */
const days = z.number().int().min(0).max(3650);
const count = z.number().int().min(0).max(100000);
const page = z.string().regex(/^\/[A-Za-z0-9\-_/.]*$/, "page must be a path like /podcast");

export const RuleSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("source"),
    cmp: z.enum(["is", "is_not", "in"]),
    value: z.union([z.enum(SOURCES), z.array(z.enum(SOURCES)).min(1)]),
  }),
  z.object({
    field: z.literal("status"),
    cmp: z.enum(["is", "is_not"]),
    value: z.enum(STATUSES),
  }),
  z.object({
    field: z.literal("signup_date"),
    cmp: z.enum(["before", "after", "in_last_days"]),
    value: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days]),
  }),
  z.object({
    field: z.literal("days_since_open"),
    cmp: z.enum(["gt", "lt", "between", "never"]),
    value: z.union([days, z.tuple([days, days])]).optional(),
  }),
  z.object({
    field: z.literal("visited_page"),
    cmp: z.enum(["has", "has_not", "at_least"]),
    value: page,
    times: count.optional(),
  }),
  z.object({
    field: z.literal("utm_source"),
    cmp: z.enum(["is", "in"]),
    value: z.union([z.enum(SOURCES), z.array(z.enum(SOURCES)).min(1)]),
  }),
  z.object({
    field: z.literal("web_visits"),
    cmp: z.enum(["gt", "lt"]),
    value: count,
    days: days.default(30),
  }),
  z.object({
    field: z.literal("has_app"),
    cmp: z.enum(["yes", "no"]),
  }),
  z.object({
    field: z.literal("app_events"),
    cmp: z.enum(["gt", "lt"]),
    value: count,
    event: z.enum(APP_EVENT_TYPES).optional(),
    days: days.default(30),
  }),
  z.object({
    field: z.literal("last_app_activity"),
    cmp: z.enum(["within", "older_than"]),
    value: days,
  }),
  z.object({
    field: z.literal("engagement_score"),
    cmp: z.enum(["gt", "lt", "between"]),
    value: z.union([z.number().int().min(0).max(100), z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100)])]),
  }),
  z.object({
    field: z.literal("churn_tier"),
    cmp: z.enum(["is", "is_not"]),
    value: z.enum(CHURN_TIERS),
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

export type Group = { op: "AND" | "OR"; rules: Array<Rule | Group> };
export const GroupSchema: z.ZodType<Group> = z.lazy(() =>
  z.object({
    op: z.enum(["AND", "OR"]),
    rules: z.array(z.union([RuleSchema, GroupSchema])).max(50),
  }),
);
export const FilterSchema = GroupSchema;
export type Filter = Group;

/** UI metadata: labels and which comparisons each field offers. */
export const FIELD_META: Record<
  Rule["field"],
  { label: string; cmps: { id: string; label: string }[]; hint?: string }
> = {
  source: { label: "Acquisition source", cmps: [{ id: "is", label: "is" }, { id: "is_not", label: "is not" }, { id: "in", label: "is any of" }] },
  status: { label: "Status", cmps: [{ id: "is", label: "is" }, { id: "is_not", label: "is not" }] },
  signup_date: { label: "Signup date", cmps: [{ id: "before", label: "before" }, { id: "after", label: "after" }, { id: "in_last_days", label: "in last N days" }] },
  days_since_open: { label: "Days since last open", cmps: [{ id: "gt", label: "more than" }, { id: "lt", label: "less than" }, { id: "between", label: "between" }, { id: "never", label: "never opened" }] },
  visited_page: { label: "Visited page", cmps: [{ id: "has", label: "has visited" }, { id: "has_not", label: "has not visited" }, { id: "at_least", label: "visited at least N times" }] },
  utm_source: { label: "UTM source", cmps: [{ id: "is", label: "is" }, { id: "in", label: "is any of" }] },
  web_visits: { label: "Web visits in last N days", cmps: [{ id: "gt", label: "more than" }, { id: "lt", label: "less than" }] },
  has_app: { label: "Has app account", cmps: [{ id: "yes", label: "yes" }, { id: "no", label: "no" }] },
  app_events: { label: "App events in last N days", cmps: [{ id: "gt", label: "more than" }, { id: "lt", label: "less than" }] },
  last_app_activity: { label: "Last app activity", cmps: [{ id: "within", label: "within N days" }, { id: "older_than", label: "older than N days" }] },
  engagement_score: { label: "Engagement score", cmps: [{ id: "gt", label: "more than" }, { id: "lt", label: "less than" }, { id: "between", label: "between" }] },
  churn_tier: { label: "Churn risk tier", cmps: [{ id: "is", label: "is" }, { id: "is_not", label: "is not" }] },
};
