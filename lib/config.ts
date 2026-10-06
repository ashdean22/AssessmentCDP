/**
 * Shared constants. The assessment brief fixes "today" at 2026-09-28 for all
 * time math, so business logic must use REFERENCE_DATE and never `new Date()`.
 */
export const REFERENCE_DATE = new Date("2026-09-28T00:00:00Z");

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days between REFERENCE_DATE and `d` (positive when `d` is in the past). */
export function daysAgo(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((REFERENCE_DATE.getTime() - d.getTime()) / DAY_MS);
}

export const APP_EVENT_TYPES = ["app_open", "read_story", "link_click", "login"] as const;
export type AppEventType = (typeof APP_EVENT_TYPES)[number];

/** Webhook requests older than this are rejected as replays. */
export const WEBHOOK_MAX_AGE_SECONDS = 5 * 60;
