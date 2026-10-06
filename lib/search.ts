/**
 * Email autocomplete for the Lookup page (behind the login; never reaches the
 * model). Prefix-only: a reader has to type the start of an address, and the
 * server returns at most a handful of matches.
 */
export const SUGGEST_MIN_CHARS = 2;
export const SUGGEST_LIMIT = 8;

/** Lowercased, trimmed prefix with LIKE wildcards escaped; null if too short. */
export function emailPrefix(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim().toLowerCase();
  if (q.length < SUGGEST_MIN_CHARS || q.length > 120) return null;
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}
