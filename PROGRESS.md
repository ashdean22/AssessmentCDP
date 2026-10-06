# PROGRESS

Running log of what's done against PLAN.md. Updated each phase.

## Mon Oct 5 — Setup ✅
- Next.js 16 + TS + Tailwind scaffold; Vitest, tsx, zod, csv-parse, supabase-js
- GitHub repo `ashdean22/AssessmentCDP` (public), CI (`lint` + `typecheck` + `test`) and Supabase keep-alive workflows
- Supabase project `AssessmentCDP` — 8 tables, RLS on, no public policies (`supabase/migrations/`)
- Vercel project `tpo-cdp` linked to repo; prod env vars set; https://tpo-cdp.vercel.app live, `/api/health` queries DB
- `lib/config.ts` (REFERENCE_DATE), `lib/db.ts` (server-only client)
- CSVs profiled → `DATA_NOTES.md`

## Tue Oct 6 – Wed Oct 7 — Import ✅ (done Oct 6)
- `lib/normalize.ts` — the one `normalizeEmail()`, plus `parseDateUTC`, `normalizeSource`, `normalizeStatus`
- `lib/pii/mask.ts` — HMAC email hash + `sub_xxxxxxxx` masked id
- `lib/import/merge.ts` — pure clean/dedupe/stitch/link functions
- `scripts/import.ts` — upserts on natural keys; re-run verified identical
- Production DB loaded: 2,900 subscribers, 10,000 web events (8,441 linked), 930 app users (900 linked), 10 issues
- Tests: 22 passing (`tests/normalize`, `tests/merge`, `tests/mask`)

## Thu Oct 8 — Login and lookup ✅ (done Oct 6)
- `lib/auth.ts` signed stateless session (HMAC, 7-day), constant-time password check
- `proxy.ts` locks everything except `/login`, `/webhooks/app`, `/api/vapi/tools`, `/api/health`; API paths get 401, pages redirect
- `app/login` server action + form; sign-out in nav
- `lib/score.ts` + `lib/metrics.ts` engagement score, churn tier, shared definitions
- `lib/profile.ts` + `app/(dashboard)/lookup` — normalized email search, newsletter card, merged timeline (event time), linked IDs
- Placeholder dashboard with live counts
- Tests: 30 passing (+auth, +score)

## Fri Oct 9 – Sat Oct 10 — Filter builder ⏳
