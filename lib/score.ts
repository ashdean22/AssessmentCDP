import { daysAgo } from "@/lib/config";

/**
 * Explainable engagement score (see DEFINITIONS.engagement_score). Pure
 * function so it can be unit-tested and recomputed on every new event.
 */
export interface ScoreInput {
  lastOpenDate: Date | null;
  webVisitsLast30d: number;
  appEventsLast30d: number;
}

export interface ScoreBreakdown {
  recency: number;
  web: number;
  app: number;
  total: number;
}

export function recencyPoints(lastOpenDate: Date | null): number {
  const d = daysAgo(lastOpenDate);
  if (d === null) return 0;
  if (d <= 7) return 40;
  if (d <= 30) return 25;
  if (d <= 60) return 10;
  return 0;
}

export function engagementScore(i: ScoreInput): ScoreBreakdown {
  const recency = recencyPoints(i.lastOpenDate);
  const web = Math.min(30, Math.max(0, i.webVisitsLast30d) * 5);
  const app = Math.min(30, Math.max(0, i.appEventsLast30d) * 3);
  return { recency, web, app, total: recency + web + app };
}

export const CHURN_TIERS = ["active", "cooling", "at_risk", "cold"] as const;
export type ChurnTier = (typeof CHURN_TIERS)[number];

export function churnTier(score: number): ChurnTier {
  if (score >= 70) return "active";
  if (score >= 40) return "cooling";
  if (score >= 15) return "at_risk";
  return "cold";
}

export const TIER_LABEL: Record<ChurnTier, string> = {
  active: "Active",
  cooling: "Cooling",
  at_risk: "At risk",
  cold: "Cold",
};
