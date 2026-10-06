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

## Fri Oct 9 – Sat Oct 10 — Filter builder ✅ (done Oct 6)
- `lib/segments/fields.ts` zod allowlist of 12 fields × comparisons; nested AND/OR groups
- `lib/segments/compile.ts` → parameterized WHERE (values only ever in `$1` jsonb); human "what ran" description
- DB: `segment_count` / `segment_rows` RPCs (service role only), `reference_date()`, `subscriber_activity` view, `distinct_pages`
- `lib/score-db.ts` recomputes score/tier from the one formula in `lib/score.ts`; import now fills them (2,900 scored)
- APIs: `/api/segments` (list/save/delete), `/count`, `/preview`, `/api/export` (CSV with formula-injection escaping)
- UI `/segments`: nested rule builder, live count, table, save, export; beehiiv button stubbed until Oct 16
- Tests: 38 passing (+compile, +csv). Sanity: Instagram & cold 30d = 229; went cold last month = 69

## Sun Oct 11 – Mon Oct 12 — Webhook ✅ (done Oct 6)
- `POST /webhooks/app` — HMAC-SHA256 over `timestamp.body` (`X-TPO-Timestamp`, `X-TPO-Signature`), constant-time compare, 5-min window, 64 KB cap
- `lib/webhook/schema.ts` strict zod payload (event enum, slug regex, id charset); `lib/webhook/ingest.ts` idempotent on event_id, stubs unknown users, links device→user, attaches earlier anonymous events on login, resolves later anonymous events via device, recomputes the subscriber's score
- `scripts/send-event.ts` (`npm run send-event -- all --url …`): normal, duplicate, out-of-order, anon-then-login, unknown-user, bad-signature, bad-body — all behave as specified
- Tests: 46 passing (+5 verify/schema unit, +3 DB integration gated on env)

## Tue Oct 13 – Wed Oct 14 — AI chat ✅ (done Oct 6)
- `lib/pii/guard.ts` — email regex + forbidden-key scan on every tool output (fail closed); `[EMAIL]` redaction of user text
- `lib/ai/tools.ts` — 8 tools (count_segment, build_segment, top_engaged, source_quality, first_pages, app_newsletter_overlap, trend, get_definitions); lists parked in `ai_results`, model gets `result_id` + masked `sub_` ids only
- DB: `source_quality`, `first_pages`, `app_newsletter_overlap`, `trend`, `dashboard_stats` (service-role only)
- `app/api/chat` — Vercel AI SDK v7 + `@ai-sdk/anthropic` (claude-sonnet-5-5), streaming, up to 6 tool steps; `app/api/results/[id]` serves full tables behind login
- UI `/assistant`: starter chips, markdown + tables, inline trend chart (Recharts), result table with Save/Export, "What the AI saw" panel per tool call, stop/regenerate/new chat/copy
- Tests: 59 passing (+guard unit, +8 "every tool output is email-free" against real data)
- Verified: "Instagram went cold last month" → count_segment → 69; typed email redacted; zero emails in stream

## Thu Oct 15 — Vapi voice ⏳
