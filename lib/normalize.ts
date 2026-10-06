/**
 * The single set of cleaning rules for every source: CSV import, webhook,
 * search box and AI tool inputs all go through these functions. Rules were
 * derived from DATA_NOTES.md, not guessed.
 */

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * trim + lowercase. Returns null when the result is not a plausible email so
 * callers can route the row to import_issues instead of storing junk.
 * This is the ONLY email normalizer in the codebase — never write another.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const e = raw.trim().toLowerCase();
  if (e === "" || !EMAIL_RE.test(e)) return null;
  return e;
}

/**
 * Parse a date or datetime string as UTC. Accepts ISO `YYYY-MM-DD`,
 * `YYYY-MM-DD HH:MM:SS`, and anything with an explicit offset / `Z`.
 * Returns null when unparseable; callers log an import issue.
 */
export function parseDateUTC(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;

  // Date only -> midnight UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // "YYYY-MM-DD HH:MM:SS" with no zone -> treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    const d = new Date(`${s.replace(" ", "T")}Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // Explicit zone / full ISO
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** `YYYY-MM-DD` for a Date (UTC). */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const SOURCES = [
  "instagram",
  "facebook",
  "google",
  "referral",
  "direct",
  "podcast",
  "twitter",
  "other",
] as const;
export type Source = (typeof SOURCES)[number];

// Lowercased variants → canonical. Measured values plus the common aliases.
const SOURCE_MAP: Record<string, Source> = {
  instagram: "instagram",
  insta: "instagram",
  ig: "instagram",
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  google: "google",
  search: "google",
  referral: "referral",
  refer: "referral",
  friend: "referral",
  direct: "direct",
  podcast: "podcast",
  pod: "podcast",
  x: "twitter",
  twitter: "twitter",
  "x.com": "twitter",
};

/** Map any source/utm variant to one canonical value. Unknown → "other"; empty → null. */
export function normalizeSource(raw: string | null | undefined): Source | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "") return null;
  return SOURCE_MAP[s] ?? "other";
}

export const STATUSES = ["active", "unsubscribed"] as const;
export type Status = (typeof STATUSES)[number];

/** Only two values appear in the data; anything else is an import issue. */
export function normalizeStatus(raw: string | null | undefined): Status | null {
  if (raw == null) return null;
  const s = raw.trim().toLowerCase();
  if (s === "active" || s === "subscribed") return "active";
  if (s === "unsubscribed" || s === "unsub" || s === "inactive") return "unsubscribed";
  return null;
}
