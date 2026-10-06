/**
 * Pure cleaning / dedupe / linking logic for the CSV import. No I/O here so
 * it can be unit-tested against small fixtures and the real files alike.
 */
import {
  normalizeEmail,
  normalizeSource,
  normalizeStatus,
  parseDateUTC,
  type Source,
  type Status,
} from "@/lib/normalize";

export type RawRow = Record<string, string>;

export interface Issue {
  file: string;
  row_number: number; // 1-based data row (header excluded)
  problem: string;
  raw: RawRow;
}

export interface CleanSubscriber {
  email: string;
  signup_date: Date | null;
  status: Status;
  source: Source;
  last_open_date: Date | null;
}

export interface MergedSubscriber extends CleanSubscriber {
  merged_count: number;
}

// ---------------------------------------------------------------- subscribers

export function cleanSubscribers(rows: RawRow[]): { clean: CleanSubscriber[]; issues: Issue[] } {
  const clean: CleanSubscriber[] = [];
  const issues: Issue[] = [];
  rows.forEach((r, i) => {
    const row_number = i + 1;
    const file = "subscribers.csv";
    const values = Object.values(r).map((v) => (v ?? "").trim());
    if (values.every((v) => v === "")) {
      issues.push({ file, row_number, problem: "blank row", raw: r });
      return;
    }
    const email = normalizeEmail(r.email);
    if (!email) {
      issues.push({ file, row_number, problem: `invalid email: "${r.email ?? ""}"`, raw: r });
      return;
    }
    const status = normalizeStatus(r.status);
    if (!status) {
      issues.push({ file, row_number, problem: `unknown status: "${r.status ?? ""}"`, raw: r });
      return;
    }
    const signup_date = parseDateUTC(r.signup_date);
    if (!signup_date && (r.signup_date ?? "").trim() !== "") {
      issues.push({ file, row_number, problem: `unparseable signup_date: "${r.signup_date}"`, raw: r });
    }
    const last_open_date = parseDateUTC(r.last_open_date);
    if (!last_open_date && (r.last_open_date ?? "").trim() !== "") {
      issues.push({ file, row_number, problem: `unparseable last_open_date: "${r.last_open_date}"`, raw: r });
    }
    const source = normalizeSource(r.acquisition_source) ?? "other";
    clean.push({ email, signup_date, status, source, last_open_date });
  });
  return { clean, issues };
}

/**
 * Same normalized email = same person. On merge:
 *  - earliest signup_date and the source from that row (first touch)
 *  - latest last_open_date
 *  - status from the most recently active row (latest last_open; ties → latest signup)
 */
export function dedupeSubscribers(clean: CleanSubscriber[]): MergedSubscriber[] {
  const groups = new Map<string, CleanSubscriber[]>();
  for (const s of clean) groups.set(s.email, [...(groups.get(s.email) ?? []), s]);

  const out: MergedSubscriber[] = [];
  for (const [email, rows] of groups) {
    const t = (d: Date | null) => (d ? d.getTime() : null);

    const earliest = rows.reduce((a, b) => {
      const ta = t(a.signup_date), tb = t(b.signup_date);
      if (ta === null) return b;
      if (tb === null) return a;
      return tb < ta ? b : a;
    });
    const latestOpen = rows.reduce<Date | null>((acc, r) => {
      if (!r.last_open_date) return acc;
      return !acc || r.last_open_date > acc ? r.last_open_date : acc;
    }, null);
    const mostRecent = rows.reduce((a, b) => {
      const oa = t(a.last_open_date) ?? -1, ob = t(b.last_open_date) ?? -1;
      if (ob !== oa) return ob > oa ? b : a;
      const sa = t(a.signup_date) ?? -1, sb = t(b.signup_date) ?? -1;
      return sb > sa ? b : a;
    });

    out.push({
      email,
      signup_date: earliest.signup_date,
      source: earliest.source,
      last_open_date: latestOpen,
      status: mostRecent.status,
      merged_count: rows.length,
    });
  }
  return out;
}

// ---------------------------------------------------------------- web events

export interface CleanWebEvent {
  visitor_id: string;
  page: string;
  ts: Date;
  utm_source: Source | null;
  email: string | null;
}

export function cleanWebEvents(rows: RawRow[]): { clean: CleanWebEvent[]; issues: Issue[] } {
  const clean: CleanWebEvent[] = [];
  const issues: Issue[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row_number = i + 1;
    const file = "web_events.csv";
    const visitor_id = (r.visitor_id ?? "").trim();
    const page = (r.page ?? "").trim();
    if (!visitor_id || !page) {
      issues.push({ file, row_number, problem: "missing visitor_id or page", raw: r });
      return;
    }
    const ts = parseDateUTC(r.timestamp);
    if (!ts) {
      issues.push({ file, row_number, problem: `unparseable timestamp: "${r.timestamp ?? ""}"`, raw: r });
      return;
    }
    const rawEmail = (r.email ?? "").trim();
    const email = normalizeEmail(rawEmail);
    if (rawEmail && !email) {
      issues.push({ file, row_number, problem: `invalid email: "${rawEmail}"`, raw: r });
    }
    const key = `${visitor_id}|${page}|${ts.toISOString()}`;
    if (seen.has(key)) {
      issues.push({ file, row_number, problem: "exact duplicate event", raw: r });
      return;
    }
    seen.add(key);
    clean.push({ visitor_id, page, ts, utm_source: normalizeSource(r.utm_source), email });
  });
  return { clean, issues };
}

/**
 * Identity stitching: a visit links to a subscriber when its email matches;
 * every other visit with that visitor_id inherits the link.
 * Returns visitor_id -> email for every visitor that can be linked.
 */
export function stitchVisitors(events: CleanWebEvent[], knownEmails: Set<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of events) {
    if (e.email && knownEmails.has(e.email) && !map.has(e.visitor_id)) {
      map.set(e.visitor_id, e.email);
    }
  }
  return map;
}

// ---------------------------------------------------------------- app users

export interface CleanAppUser {
  user_id: string;
  email: string | null;
  created_at: Date | null;
}

export function cleanAppUsers(rows: RawRow[]): { clean: CleanAppUser[]; issues: Issue[] } {
  const clean: CleanAppUser[] = [];
  const issues: Issue[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const row_number = i + 1;
    const file = "app_users.csv";
    const user_id = (r.user_id ?? "").trim();
    if (!user_id) {
      issues.push({ file, row_number, problem: "missing user_id", raw: r });
      return;
    }
    if (seen.has(user_id)) {
      issues.push({ file, row_number, problem: `duplicate user_id: ${user_id}`, raw: r });
      return;
    }
    seen.add(user_id);
    const rawEmail = (r.email ?? "").trim();
    const email = normalizeEmail(rawEmail);
    if (rawEmail && !email) {
      issues.push({ file, row_number, problem: `invalid email: "${rawEmail}"`, raw: r });
    }
    const created_at = parseDateUTC(r.created_at);
    if (!created_at && (r.created_at ?? "").trim() !== "") {
      issues.push({ file, row_number, problem: `unparseable created_at: "${r.created_at}"`, raw: r });
    }
    clean.push({ user_id, email, created_at });
  });
  return { clean, issues };
}
