/** Browser-safe parts of the subscriber list: params, sort options, row type. */
import { SOURCES, STATUSES } from "@/lib/normalize";
import { CHURN_TIERS } from "@/lib/score";

export const PAGE_SIZE = 50;

export const SORTS = {
  last_open: { col: "last_open_date", asc: false, label: "Last open" },
  score: { col: "engagement_score", asc: false, label: "Score" },
  signup: { col: "signup_date", asc: false, label: "Newest" },
  email: { col: "email", asc: true, label: "Email A–Z" },
} as const;
export type SortKey = keyof typeof SORTS;

export type SubscriberRow = { id: number; email: string; status: string; source: string; signup_date: string | null; last_open_date: string | null; engagement_score: number | null; churn_tier: string | null; merged_count: number };

export function parseListParams(sp: URLSearchParams | Record<string, string | undefined>) {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : sp[k] ?? "");
  const sort = (get("sort") in SORTS ? get("sort") : "last_open") as SortKey;
  return {
    page: Math.max(1, Number(get("page")) || 1),
    sort,
    tier: CHURN_TIERS.includes(get("tier") as never) ? get("tier") : "",
    status: STATUSES.includes(get("status") as never) ? get("status") : "",
    source: SOURCES.includes(get("source") as never) ? get("source") : "",
    q: get("q").slice(0, 120),
  };
}
export type ListParams = ReturnType<typeof parseListParams>;
