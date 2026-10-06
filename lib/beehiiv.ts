/**
 * beehiiv push — MOCK MODE.
 *
 * beehiiv's public API has no bulk-create endpoint; each subscriber is one
 * `POST /v2/publications/{publicationId}/subscriptions` call. This module
 * builds exactly those requests so the UI can show what would be sent. No
 * request ever leaves the server (see app/api/beehiiv/push/route.ts), and
 * the README lists this under Known limitations.
 */
export interface PushRow {
  email: string;
  source: string;
  churn_tier: string | null;
  engagement_score: number | null;
}

export interface BeehiivSubscriptionBody {
  email: string;
  reactivate_existing: boolean;
  send_welcome_email: boolean;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  custom_fields: { name: string; value: string }[];
}

export interface BeehiivPushPlan {
  mode: "mock";
  method: "POST";
  url: string;
  headers: Record<string, string>;
  segment: string;
  total_requests: number;
  sample: BeehiivSubscriptionBody[];
}

export const MOCK_PUBLICATION_ID = "pub_00000000-0000-0000-0000-000000000000";

export function campaignSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "segment";
}

/** Mask a key for display: first 4 chars, then dots. Never return the full key. */
export function maskKey(key: string | undefined): string {
  if (!key) return "<BEEHIIV_API_KEY not set>";
  return `${key.slice(0, 4)}••••`;
}

export function subscriptionBody(row: PushRow, segmentName: string): BeehiivSubscriptionBody {
  return {
    email: row.email,
    reactivate_existing: false,
    send_welcome_email: false,
    utm_source: row.source,
    utm_medium: "tpo-cdp",
    utm_campaign: campaignSlug(segmentName),
    custom_fields: [
      { name: "tpo_segment", value: segmentName },
      { name: "churn_tier", value: row.churn_tier ?? "" },
      { name: "engagement_score", value: row.engagement_score == null ? "" : String(row.engagement_score) },
    ],
  };
}

export function buildBeehiivPush(opts: {
  segmentName: string;
  rows: PushRow[];
  publicationId?: string;
  apiKey?: string;
  sampleSize?: number;
}): BeehiivPushPlan {
  const pub = opts.publicationId || MOCK_PUBLICATION_ID;
  const n = Math.max(0, opts.sampleSize ?? 3);
  return {
    mode: "mock",
    method: "POST",
    url: `https://api.beehiiv.com/v2/publications/${pub}/subscriptions`,
    headers: { Authorization: `Bearer ${maskKey(opts.apiKey)}`, "Content-Type": "application/json" },
    segment: opts.segmentName,
    total_requests: opts.rows.length,
    sample: opts.rows.slice(0, n).map((r) => subscriptionBody(r, opts.segmentName)),
  };
}
