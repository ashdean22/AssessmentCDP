/**
 * Shared metric definitions. Used by the UI, the segment compiler and the AI
 * system prompt so every surface answers the same way. Days are measured
 * from REFERENCE_DATE (lib/config.ts).
 */
export const DEFINITIONS = {
  cold: "No newsletter open in 30+ days, or never opened.",
  went_cold_last_month: "Last open was 31 to 60 days ago.",
  engaged: "Engagement score ≥ 70.",
  loyal: "Signed up 90+ days ago and opened in the last 30 days.",
  new_subscriber: "Signed up in the last 30 days.",
  first_page: "Earliest web visit on or after the signup date.",
  engagement_score:
    "0–100. Newsletter recency up to 40 (opened ≤7d: 40, ≤30d: 25, ≤60d: 10, else 0) + web visits in last 30d × 5 (max 30) + app events in last 30d × 3 (max 30).",
  churn_tier: "Active 70+, Cooling 40–69, At risk 15–39, Cold under 15.",
  last_active: "Latest event timestamp (never arrival time).",
} as const;

export type DefinitionKey = keyof typeof DEFINITIONS;
