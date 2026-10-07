# TPO Mini CDP

A small customer data platform for The Pour Over's Growth team. It merges the newsletter, website and app data into one profile per reader, takes live app events over a signed webhook, builds segments, and answers plain-English questions by chat or voice **without the AI ever seeing an email address**.

- **Live:** https://tpo-cdp.vercel.app (password-protected)
- **Webhook:** `POST https://tpo-cdp.vercel.app/webhooks/app` (HMAC-signed; secret shared out of band)
- **Stack:** Next.js 16 (App Router, TypeScript) · Supabase Postgres · Tailwind · Recharts · Vercel AI SDK + Claude · Vapi (voice) · Vitest · GitHub Actions · Vercel

"Today" is fixed at **2026-09-28** for every time-based calculation, as the brief requires (`REFERENCE_DATE` in `lib/config.ts`).

---

## Run it locally

Prerequisites: Node 22, npm, a Supabase project (free tier is fine), an Anthropic API key. Vapi keys are optional (the mic button disables itself without them).

```bash
git clone https://github.com/ashdean22/AssessmentCDP.git
cd AssessmentCDP
npm ci
cp .env.example .env.local      # fill in the values (table below)

# 1. Create the schema: run the three files in supabase/migrations/ in order
#    (Supabase SQL editor, or `supabase db push` with the CLI).
# 2. Load the CSVs (re-runnable; prints a report):
npm run import
# 3. Start the app:
npm run dev                     # http://localhost:3000 → /login
```

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run profile` | Profiles the three CSVs and prints what's messy (source of `DATA_NOTES.md`) |
| `npm run import` | Cleans, dedupes, links and upserts the CSVs into Supabase, then scores every subscriber |
| `npm run send-event -- all --url http://localhost:3000` | Signs and sends test webhook events: normal, duplicate, out-of-order, anonymous-then-login, unknown user, bad signature, bad body |
| `npm run vapi-assistant -- --url https://your-host` | Creates/updates the Vapi voice assistant from the same tool definitions the chat uses |
| `npm test` / `npm run typecheck` / `npm run lint` | Vitest (69 tests), `tsc --noEmit`, ESLint. CI runs all three on every push |

### Environment variables

| Name | Used for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database. Server only; RLS is on with no public policies, so this key is the only way in |
| `APP_PASSWORD`, `SESSION_SECRET` | Dashboard login and the signed session cookie |
| `WEBHOOK_SECRET` | HMAC key for `POST /webhooks/app` |
| `MASK_SECRET` | HMAC key for the `sub_xxxxxxxx` ids the AI sees instead of emails |
| `ANTHROPIC_API_KEY`, `CHAT_MODEL` (optional) | Chat assistant and win-back drafts. Default model `claude-sonnet-5-5` |
| `VAPI_PRIVATE_KEY`, `VAPI_SERVER_SECRET`, `VAPI_ASSISTANT_ID`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | Voice assistant. The two `NEXT_PUBLIC_` values are the only ones that reach the browser |
| `BEEHIIV_PUBLICATION_ID`, `BEEHIIV_API_KEY` (optional) | Only fill in the *displayed* mock payload; nothing is ever sent to beehiiv |

---

## Architecture

```
SOURCES               INTAKE                    STORE                 USE
subscribers.csv ─┐                                               ┌─> Dashboard, lookup, segments (login; full data)
web_events.csv  ─┼─> scripts/import.ts ──┐                       │
app_users.csv   ─┘   clean·dedupe·link   ├─> Supabase Postgres ──┤
                                         │   (RLS, service key)  └─> AI tools  ──PII guard──>  Claude chat / Vapi voice
Mobile app ──> POST /webhooks/app ───────┘                              counts, %, pages, masked ids, result_id only
               HMAC + replay window
```

| Table | Holds |
| --- | --- |
| `subscribers` | One row per real person: normalized email (unique), `email_hash`, signup date, status, source, last open, `merged_count`, `engagement_score`, `churn_tier` |
| `web_events` | Every site visit, with `subscriber_id` once stitched |
| `app_users` | App accounts plus stub profiles for user ids first seen on the webhook (`is_stub`) |
| `devices` | device → user links learned from the webhook |
| `app_events` | Live events, unique on `event_id`, `resolved_user_id` after stitching |
| `segments` | Saved filters as JSON |
| `ai_results` | Full tables the AI only ever refers to by `result_id` |
| `import_issues` | Rows the import rejected, with the reason |

Key code:

| Path | Role |
| --- | --- |
| `lib/normalize.ts` | **The one** `normalizeEmail()` plus date/source/status normalizers |
| `lib/import/merge.ts`, `scripts/import.ts` | Pure clean/dedupe/stitch logic, and the upsert runner |
| `lib/webhook/verify.ts`, `schema.ts`, `ingest.ts`, `app/webhooks/app/route.ts` | Signature check, Zod payload, idempotent ingest + identity stitching |
| `lib/segments/fields.ts`, `compile.ts`, `run.ts` | Allowlisted filter schema → parameterized WHERE clause → RPC |
| `lib/score.ts`, `lib/score-db.ts`, `lib/metrics.ts` | Engagement score, churn tiers, shared metric definitions |
| `lib/ai/tools.ts`, `lib/ai/prompt.ts`, `lib/pii/guard.ts`, `lib/pii/mask.ts` | The AI's only window onto the data |
| `app/api/chat`, `app/api/vapi/tools`, `app/api/results/[id]` | Chat (Vercel AI SDK), voice tool webhook, full tables for the browser |
| `proxy.ts` | Locks every route except `/login`, `/webhooks/app`, `/api/vapi/tools`, `/api/health` |
| `supabase/migrations/` | Schema, RLS, segment/aggregate SQL functions |

---

## Data cleaning, dedupe and linking

The CSVs were profiled before any logic was written; findings and the raw numbers are in `DATA_NOTES.md`. In short: emails differ by case and whitespace, there are blank rows and two invalid emails, sources are inconsistently cased (`X` vs `twitter`), 494 subscribers never opened, and all dates are clean ISO.

**Cleaning** (`lib/normalize.ts`): `normalizeEmail()` trims and lowercases and rejects anything without a local part, `@`, and a dotted domain. It is the only email normalizer in the repo and is used by the import, the lookup page and the webhook. Dates parse as UTC; unparseable dates become `null` plus an `import_issues` row. Sources map through a lookup table to `instagram, facebook, google, referral, direct, podcast, twitter, other`. Status is the fixed pair `active | unsubscribed`.

**Dedupe rule:** same normalized email = same person. When rows merge: keep the earliest signup date and its source (first touch), the latest last-open date, and the status from the most recently active row. `merged_count` records how many rows collapsed.

**Linking rules:** a web visit links to a subscriber when its email matches; every other visit with that `visitor_id` inherits the link (identity stitching). An app user links to a subscriber by email; app users without a match are kept as app-only profiles. App events link through `app_users.user_id`.

**Import result** (idempotent; a second run changes nothing): 2,995 → **2,900 subscribers** (85 merged, 10 rejected), 10,000 web events (8,441 linked via 1,400 stitched visitors), 930 app users (900 linked), 10 issues logged.

**Edge cases not handled, on purpose:** plus-aliases (`name+tpo@gmail.com`) are treated as different people; a shared device or a visitor id used by two people would stitch to whichever email was seen (the data has zero such cases); a subscriber whose email changes is two profiles; app-only users have no newsletter card.

---

## Webhook: `POST /webhooks/app`

Authentication is what you'd use in production: **HMAC-SHA256 over `timestamp.body`** with a shared secret, constant-time comparison, a **5-minute replay window** (the timestamp is inside the signature so it can't be swapped), and a **64 KB body cap**. Missing or bad signature → `401`. Payloads are validated with Zod (`event` must be `app_open | read_story | link_click | login`, story slugs must match `^[a-z0-9-]+$`, ids have a fixed charset, unknown keys rejected) → `400`.

```
X-TPO-Timestamp: 1759766400                      # unix seconds
X-TPO-Signature: hex(HMAC_SHA256(secret, "1759766400." + rawBody))
Content-Type: application/json

{"event_id":"evt_9f3a1c","event":"read_story","user_id":"u_2b6447a3","device_id":"d_4b21e8",
 "timestamp":"2026-09-28T14:22:05Z","properties":{"story":"supreme-court-ruling-explained"}}
```

Behaviour (`lib/webhook/ingest.ts`):

- **Duplicates:** `event_id` is the primary key; a repeat returns `200 {duplicate: true}` and changes nothing.
- **Out of order:** nothing depends on arrival order. Timelines and "last active" sort by the event `timestamp`, never `received_at`.
- **Login with prior anonymous events:** the device is linked to the user and every earlier event from that device with no user gets `resolved_user_id` set. The response reports `attached_anonymous_events`.
- **Anonymous event after login:** if the device is already linked, the event is attributed to that user on arrival.
- **Unknown `user_id`:** a stub `app_users` row is created (`is_stub = true`), never dropped; it gets a profile and shows in lookup.
- **No restart needed:** lookup, segments and the dashboard query the database live. The subscriber's engagement score is recomputed on every event.

`npm run send-event -- all --url https://tpo-cdp.vercel.app` runs every scenario against the live endpoint.

---

## Segments

A filter is a tree of rules (`field + comparison + value`) in AND/OR groups that can nest. Twelve fields are allowlisted in `lib/segments/fields.ts` (source, status, signup date, days since open, visited page, UTM source, web visits in N days, has app, app events by type in N days, last app activity, engagement score, churn tier). `lib/segments/compile.ts` turns the JSON into a WHERE clause where **every user value travels as a parameter** (`($1->>'pN')`) and nothing is interpolated. The UI and the AI share this compiler, so "Instagram signups that went cold last month" is the same query (and the same 69 readers) whichever way you ask.

Results: live count, table, save, CSV export (server-built, cells starting with `= + - @` are escaped), and a mock push to beehiiv.

---

## AI assistant: how PII stays out

The brief's hard requirement is that the model never sees emails, names or anything identifying. Five layers, each independently sufficient for its part:

1. **Tools, not SQL.** The model picks from eight fixed tools (`lib/ai/tools.ts`) and never writes a query. Filters it proposes go through the same allowlisted compiler as the UI.
2. **Masked ids.** A reader is `sub_` + 8 hex chars of `HMAC(email, MASK_SECRET)` (`lib/pii/mask.ts`). Stable, so follow-ups work; unreadable without the secret, so a leaked transcript reveals nothing.
3. **Result ids.** Tools that produce lists park the full table in `ai_results` and give the model only a `result_id`, a count and up to five masked ids. The browser fetches the table from `/api/results/[id]` behind the login. Emails appear on screen because the *browser* loaded them; the model never had them.
4. **Fail-closed guard.** `lib/pii/guard.ts` scans every tool output for email patterns and forbidden keys (`email`, `name`, `phone`, …) and throws if it finds one, so the model gets an error instead of the data. Anything a user types is run through `redactEmails()` first, so a pasted address reaches the model as `[EMAIL]`.
5. **Proof.** `tests/tools-pii.integration.test.ts` runs every tool against the real database and fails if any output contains an email. The chat UI has a "What the AI saw" panel showing each tool's exact input and output.

Page paths, story slugs and other text that come back from tools are treated as data, never instructions, and the system prompt says so.

| Tool | Returns to the model |
| --- | --- |
| `count_segment(filter)` | Count + the human description of what ran |
| `build_segment(filter, name)` | Count, `result_id`, 5 masked ids |
| `top_engaged(limit)` | Masked ids with score, tier, source + `result_id` |
| `source_quality()` | Per source: signups, % active, avg score, % with app, % loyal, % cold |
| `first_pages(new_within_days)` | Top first pages with counts |
| `app_newsletter_overlap()` | Counts only |
| `trend(metric, bucket, periods)` | Weekly/daily series |
| `get_definitions()` | The metric definitions in `lib/metrics.ts` |

Shared definitions (also in the system prompt, and the assistant states which it used): cold = no open in 30+ days or never; went cold last month = last open 31–60 days ago; engaged = score ≥ 70; loyal = signed up 90+ days ago and opened in the last 30; new = signed up in the last 30 days; first page = earliest visit on or after signup.

**Voice** (`app/(dashboard)/assistant/voice.tsx`, `app/api/vapi/tools`): the mic button in the chat panel starts a Vapi call. Data tools are Vapi server tools hitting `/api/vapi/tools`, which checks Vapi's `x-vapi-secret` header, runs the same tool code and the same PII guard. `show_result` is a client-side tool with no server URL: Vapi hands it to the browser, which draws the table; nothing goes back to the model. Voice refuses email lookups and points to the Lookup page. `scripts/vapi-assistant.ts` builds the assistant from the chat's tool definitions so the two can't drift.

---

## Extras

- **Subscribers list** (`/subscribers`): every deduped reader; filters apply as you type (tier, status, source, email prefix), sort, paginate, click through to the profile. The URL stays shareable.
- **Lookup autocomplete:** prefix suggestions as you type (min 2 characters, max 8 results) from `/api/subscribers/suggest`, behind the login and never near the model.
- **ⓘ hints** on every section explaining what it does.
- **The Pour Over's voice everywhere:** one tone guide (`lib/tone.ts`) feeds the chat prompt, the voice assistant and the win-back drafts. The UI uses the site's Poppins type, coral accent and espresso text.
- **Dashboard:** readers, % active, % cold, app users, events today; churn-tier bar; signups by source; readers by last-open week (labelled honestly: the data holds one last-open date per reader, not every open); signups by week; first pages for new subscribers; a live feed of the newest webhook arrivals.
- **Engagement score and churn risk** (`lib/score.ts`): recency up to 40 (opened ≤7d 40, ≤30d 25, ≤60d 10) + 5 per web visit in 30 days (max 30) + 3 per app event in 30 days (max 30). Tiers: Active 70+, Cooling 40–69, At risk 15–39, Cold <15. Plain rules, recomputed on every event.
- **Reach out before they're gone:** one click saves the At-risk segment; the AI drafts a win-back email from **aggregates only** (`lib/winback.ts`; the exact stats are shown next to the draft); copy it or push the segment.
- **beehiiv push (mock):** builds the real per-subscriber `POST /v2/publications/{id}/subscriptions` bodies, logs a summary, shows them under a "Mock mode" badge. Nothing is sent.
- **CSV export** of any segment, up to 5,000 rows.

---

## Security

- Single shared password; constant-time compare; stateless HMAC-signed session cookie (`httpOnly`, `secure` in production, 7-day expiry). `proxy.ts` locks every route except the login page and the three machine endpoints.
- Webhook: HMAC-SHA256 with timestamp binding, 5-minute window, constant-time compare, 64 KB cap, strict Zod schema.
- Vapi tool endpoint: constant-time check of the `x-vapi-secret` header; refuses any tool not in the allowlist.
- Supabase: service-role key is server-only (`lib/db.ts` is marked `server-only`); RLS enabled on every table with no public policies; every SQL function has `EXECUTE` revoked from `anon`, `authenticated` and `public`.
- Segments: allowlisted fields, parameterized values; the model never writes SQL.
- AI: tools only, masked ids, result ids, fail-closed PII guard, input redaction; tool outputs are data, not instructions.
- CSV export escapes formula-leading cells. Secrets live only in Vercel env vars; `.env.example` has placeholders.
- Keep-alive: `.github/workflows/keepalive.yml` hits `/api/health` every two days so the free Supabase project never pauses during review.

---

## Tests

`npm test` runs 73 Vitest tests in `tests/`: email normalization; dedupe (dates, status, source precedence); web/app linking and visitor stitching; the filter compiler (nested AND/OR, unknown fields rejected, parameterization); CSV escaping; session auth; webhook signature (bad/missing/replayed/tampered), payload schema, and an ingest integration test (duplicate, out-of-order, anonymous-then-login, unknown user); the PII guard; a live test that every AI tool's output is email-free; the Vapi route (secret, unknown tools, guard); beehiiv payloads; win-back stats; email-prefix search escaping and the shared tone guide. Integration tests skip automatically when no database env is present. CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests on every push.

---

## Known limitations

Everything stubbed, mocked or hardcoded, in one place:

- **beehiiv push is a mock.** `lib/beehiiv.ts` builds the requests; `app/api/beehiiv/push/route.ts` logs and returns them; nothing is sent. The placeholder publication id `pub_00000000-…` is used when `BEEHIIV_PUBLICATION_ID` is unset.
- **Reference date is hardcoded** to 2026-09-28 by design (`lib/config.ts`, repeated as a literal in `lib/ai/prompt.ts`, `lib/winback.ts`, `scripts/vapi-assistant.ts` and the dashboard caption). "Events today" means events dated that day.
- **One shared password, no accounts, no rate limiting** on login, the webhook or the Vapi endpoint. `/api/health` is public and returns the subscriber count.
- **Vapi secret is a static shared header**, and the voice model is set in `scripts/vapi-assistant.ts` (`claude-sonnet-4-5-20250929`, the newest Anthropic model Vapi offers). The voice is ElevenLabs "sarah" through Vapi's built-in credits, with Vapi's "Leah" as the scripted fallback. Voice filters use a flat schema (one AND/OR group, no nesting) because Vapi rejects recursive JSON schemas; the server still validates with the full schema.
- **Chat model** defaults to `claude-sonnet-5-5` (`CHAT_MODEL` env); up to 6 tool steps per answer; chat history is capped at 60 messages.
- **`ai_results` rows never expire**; CSV export and AI segments cap at 5,000 rows; result tables render the first 200; `distinct_pages` autocompletes the top 200 pages.
- **Live event feed sorts by arrival time** (so a just-sent event is always on top); every other view sorts by event time.
- **Scores recompute** for the affected subscriber on each webhook event and for everyone on import; nothing recomputes on the passage of (fixed) time.
- **Dedupe edge cases** listed above: plus-aliases, shared devices, one visitor id for two people, changed emails.
- **Keep-alive** depends on the `APP_URL` GitHub repository variable and GitHub's cron, which can be delayed.
- **Hosting:** Vercel functions are pinned to `pdx1` (`vercel.json`) because the Supabase project lives in `us-west-2`; a cross-country hop was adding ~400 ms to every query.
- The import runs from a laptop against the production database (no scheduled re-import); `supabase/migrations/` are applied by hand (no migration runner wired into deploy).
