/**
 * Last line of defence between the database and the model.
 *
 *  - `redactEmails` scrubs anything a user types before it reaches the model.
 *  - `assertNoPii` scans every tool output (as JSON text). If anything that
 *    looks like an email or a raw name/email column slips through, the tool
 *    call fails closed and the model gets an error instead of the data.
 */
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Keys that must never appear in anything handed to the model.
const FORBIDDEN_KEYS = new Set(["email", "emails", "name", "first_name", "last_name", "full_name", "phone", "address"]);

export function redactEmails(text: string): string {
  return text.replace(EMAIL_RE, "[EMAIL]");
}

export class PiiLeakError extends Error {
  constructor(public readonly where: string) {
    super(`PII guard blocked tool output: ${where}`);
  }
}

function walk(value: unknown, path: string, hits: string[]) {
  if (value == null) return;
  if (typeof value === "string") {
    if (EMAIL_RE.test(value)) hits.push(`${path}: email pattern`);
    EMAIL_RE.lastIndex = 0;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, hits));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) hits.push(`${path}.${k}: forbidden key`);
      walk(v, `${path}.${k}`, hits);
    }
  }
}

/** Returns the list of problems (empty = clean). */
export function findPii(output: unknown): string[] {
  const hits: string[] = [];
  walk(output, "$", hits);
  return hits;
}

/** Throws PiiLeakError if the output is not clean; otherwise returns it unchanged. */
export function assertNoPii<T>(output: T): T {
  const hits = findPii(output);
  if (hits.length) throw new PiiLeakError(hits.slice(0, 3).join("; "));
  return output;
}
