import { FilterSchema, type Filter, type Group, type Rule } from "./fields";

/**
 * Turns a validated filter tree into a SQL WHERE clause over `subscribers s`.
 * Every user-supplied value becomes a jsonb parameter read as ($1->>'pN');
 * nothing from the filter is ever concatenated into the SQL text. The same
 * compiler serves the UI and the AI, so both always agree.
 */
export interface Compiled {
  where: string;
  params: Record<string, unknown>;
  /** Human-readable version shown in the UI / AI answers ("what ran"). */
  description: string;
}

class Ctx {
  params: Record<string, unknown> = {};
  private n = 0;
  text(v: string) { return this.add(v, "text"); }
  int(v: number) { return this.add(v, "int"); }
  date(v: string) { return this.add(v, "date"); }
  /** Array of strings → `select jsonb_array_elements_text($1->'pN')` */
  textArray(v: string[]) {
    const k = `p${this.n++}`;
    this.params[k] = v;
    return `(select jsonb_array_elements_text($1->'${k}'))`;
  }
  private add(v: unknown, cast: string) {
    const k = `p${this.n++}`;
    this.params[k] = v;
    return `($1->>'${k}')::${cast}`;
  }
}

const REF = "reference_date()";

function cmpOp(cmp: "gt" | "lt"): string {
  return cmp === "gt" ? ">" : "<";
}

function compileRule(r: Rule, c: Ctx): { sql: string; text: string } {
  switch (r.field) {
    case "source": {
      if (r.cmp === "in") {
        const arr = Array.isArray(r.value) ? r.value : [r.value];
        return { sql: `s.source in ${c.textArray(arr)}`, text: `source is any of ${arr.join(", ")}` };
      }
      const v = Array.isArray(r.value) ? r.value[0] : r.value;
      return r.cmp === "is"
        ? { sql: `s.source = ${c.text(v)}`, text: `source = ${v}` }
        : { sql: `s.source <> ${c.text(v)}`, text: `source ≠ ${v}` };
    }
    case "status":
      return r.cmp === "is"
        ? { sql: `s.status = ${c.text(r.value)}`, text: `status = ${r.value}` }
        : { sql: `s.status <> ${c.text(r.value)}`, text: `status ≠ ${r.value}` };
    case "signup_date": {
      if (r.cmp === "in_last_days") {
        const n = typeof r.value === "number" ? r.value : 30;
        return { sql: `s.signup_date >= ${REF} - ${c.int(n)}`, text: `signed up in last ${n} days` };
      }
      const d = String(r.value);
      return r.cmp === "before"
        ? { sql: `s.signup_date < ${c.date(d)}`, text: `signed up before ${d}` }
        : { sql: `s.signup_date > ${c.date(d)}`, text: `signed up after ${d}` };
    }
    case "days_since_open": {
      const dso = `(${REF} - s.last_open_date)`;
      if (r.cmp === "never") return { sql: `s.last_open_date is null`, text: `never opened` };
      if (r.cmp === "between") {
        const [a, b] = Array.isArray(r.value) ? r.value : [0, 0];
        return { sql: `(s.last_open_date is not null and ${dso} between ${c.int(a)} and ${c.int(b)})`, text: `last open ${a} to ${b} days ago` };
      }
      const n = typeof r.value === "number" ? r.value : 30;
      return r.cmp === "gt"
        ? { sql: `(s.last_open_date is null or ${dso} > ${c.int(n)})`, text: `last open more than ${n} days ago (or never)` }
        : { sql: `(s.last_open_date is not null and ${dso} < ${c.int(n)})`, text: `last open less than ${n} days ago` };
    }
    case "visited_page": {
      const base = `select 1 from web_events w where w.subscriber_id = s.id and w.page = ${c.text(r.value)}`;
      if (r.cmp === "has") return { sql: `exists (${base})`, text: `visited ${r.value}` };
      if (r.cmp === "has_not") return { sql: `not exists (${base})`, text: `never visited ${r.value}` };
      const n = r.times ?? 1;
      return { sql: `(select count(*) from web_events w where w.subscriber_id = s.id and w.page = ${c.text(r.value)}) >= ${c.int(n)}`, text: `visited ${r.value} at least ${n} times` };
    }
    case "utm_source": {
      const arr = Array.isArray(r.value) ? r.value : [r.value];
      const cond = r.cmp === "in" ? `w.utm_source in ${c.textArray(arr)}` : `w.utm_source = ${c.text(arr[0])}`;
      return { sql: `exists (select 1 from web_events w where w.subscriber_id = s.id and ${cond})`, text: `has a visit with utm ${arr.join("/")}` };
    }
    case "web_visits": {
      const sub = `(select count(*) from web_events w where w.subscriber_id = s.id and w.ts >= (${REF} - ${c.int(r.days)})::timestamptz)`;
      return { sql: `${sub} ${cmpOp(r.cmp)} ${c.int(r.value)}`, text: `${r.cmp === "gt" ? "more" : "fewer"} than ${r.value} web visits in last ${r.days} days` };
    }
    case "has_app": {
      const ex = `exists (select 1 from app_users u where u.subscriber_id = s.id)`;
      return r.cmp === "yes" ? { sql: ex, text: `has app account` } : { sql: `not ${ex}`, text: `no app account` };
    }
    case "app_events": {
      const evt = r.event ? ` and e.event = ${c.text(r.event)}` : "";
      const sub = `(select count(*) from app_events e join app_users u on u.user_id = e.resolved_user_id where u.subscriber_id = s.id and e.ts >= (${REF} - ${c.int(r.days)})::timestamptz${evt})`;
      return { sql: `${sub} ${cmpOp(r.cmp)} ${c.int(r.value)}`, text: `${r.cmp === "gt" ? "more" : "fewer"} than ${r.value} ${r.event ?? "app"} events in last ${r.days} days` };
    }
    case "last_app_activity": {
      const mx = `(select max(e.ts) from app_events e join app_users u on u.user_id = e.resolved_user_id where u.subscriber_id = s.id)`;
      const cutoff = `(${REF} - ${c.int(r.value)})::timestamptz`;
      return r.cmp === "within"
        ? { sql: `${mx} >= ${cutoff}`, text: `app activity within ${r.value} days` }
        : { sql: `(${mx} is null or ${mx} < ${cutoff})`, text: `no app activity in ${r.value} days` };
    }
    case "engagement_score": {
      if (r.cmp === "between") {
        const [a, b] = Array.isArray(r.value) ? r.value : [0, 100];
        return { sql: `s.engagement_score between ${c.int(a)} and ${c.int(b)}`, text: `score ${a}–${b}` };
      }
      const n = typeof r.value === "number" ? r.value : 0;
      return { sql: `s.engagement_score ${cmpOp(r.cmp)} ${c.int(n)}`, text: `score ${r.cmp === "gt" ? ">" : "<"} ${n}` };
    }
    case "churn_tier":
      return r.cmp === "is"
        ? { sql: `s.churn_tier = ${c.text(r.value)}`, text: `tier = ${r.value}` }
        : { sql: `s.churn_tier <> ${c.text(r.value)}`, text: `tier ≠ ${r.value}` };
  }
}

function isGroup(x: Rule | Group): x is Group {
  return (x as Group).op !== undefined && Array.isArray((x as Group).rules);
}

function compileGroup(g: Group, c: Ctx): { sql: string; text: string } {
  if (g.rules.length === 0) return { sql: "true", text: "everyone" };
  const parts = g.rules.map((r) => (isGroup(r) ? compileGroup(r, c) : compileRule(r, c)));
  const joiner = g.op === "AND" ? " and " : " or ";
  return {
    sql: `(${parts.map((p) => p.sql).join(joiner)})`,
    text: parts.length === 1 ? parts[0].text : `(${parts.map((p) => p.text).join(` ${g.op} `)})`,
  };
}

/** Validate (throws ZodError on unknown fields / bad shapes) then compile. */
export function compileFilter(input: unknown): Compiled {
  const filter: Filter = FilterSchema.parse(input);
  const c = new Ctx();
  const { sql, text } = compileGroup(filter, c);
  return { where: sql, params: c.params, description: text.replace(/^\((.*)\)$/, "$1") };
}
