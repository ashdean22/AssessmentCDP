# DATA_NOTES

Measured with `npm run profile` (raw output below). Reference date: **2026-09-28**.

## Findings → cleaning rules

| Finding | Where | Rule |
| --- | --- | --- |
| 85 subscriber emails appear 2× differing only by **case or surrounding spaces**; dup rows are otherwise identical | subscribers | `normalizeEmail()` = trim + lowercase; dedupe on the result |
| 212 web-event emails and 94 app-user emails have **uppercase** letters | web_events, app_users | Same `normalizeEmail()` before linking |
| 8 fully **blank rows** (`,,,,`) | subscribers | Reject → `import_issues` |
| 2 invalid emails: `not-an-email` (no `@`) and `@gmail.com` (no local part) | subscribers | Reject → `import_issues` |
| 494 subscribers have **empty `last_open_date`** | subscribers | Store `null` = "never opened" (not an error) |
| **All dates are clean ISO** (`YYYY-MM-DD`; web timestamps `YYYY-MM-DD HH:MM:SS`, no timezone) | all | Parse as UTC; still route unparseable → null + issue |
| Source casing differs across files: `Instagram` vs `instagram`, and `X` vs `twitter` | subscribers vs web utm | Lowercase, then lookup table: `x`/`twitter` → `twitter`; unknown → `other` |
| `status` is only `active` / `unsubscribed` | subscribers | Fixed enum of those two |
| 1,400 web visitors carry an email; **all 1,400 match a subscriber**; 0 visitors share two emails; 0 emails span two visitors | web_events | Stitch: visitor_id → subscriber; 8,441 of 10,000 events inherit a link |
| 8,030 of 10,000 web events have **no utm_source** | web_events | Store `null`, treat as direct in reports |
| 930 app users, all unique; **30 have no matching subscriber** | app_users | Keep as app-only profiles (`subscriber_id = null`) |
| No plus-aliases, no duplicate user_ids | — | Edge cases to document, not handle |

Actual import result (`npm run import`, verified idempotent on a second run): **2,995 → 2,900 subscribers** (85 merged, 10 rejected), 10,000 web events (8,441 linked, 1,400 visitors stitched), 930 app users (900 linked), 10 import issues logged.

---

## Raw profile output


## subscribers.csv

Columns: `email`, `signup_date`, `status`, `acquisition_source`, `last_open_date`

| metric | value |
| --- | --- |
| rows | 2995 |
| distinct raw emails | 2988 |
| distinct normalized emails | 2903 |
| duplicate rows after normalize | 92 |

### Email issues

| metric | value |
| --- | --- |
| empty | 8 |
| leadingOrTrailingSpace | 22 |
| uppercase | 63 |
| noAt | 1 |
| plusAlias | 0 |
| multipleAt | 0 |
| invalidChars | 2 |

### status values (raw)

| value | count |
| --- | --- |
| `active` | 2691 |
| `unsubscribed` | 296 |
| `(empty)` | 8 |

### acquisition_source values (raw)

| value | count |
| --- | --- |
| `Instagram` | 925 |
| `Facebook` | 567 |
| `Referral` | 555 |
| `Google` | 354 |
| `Direct` | 236 |
| `Podcast` | 233 |
| `X` | 117 |
| `(empty)` | 8 |

### signup_date formats

| value | count |
| --- | --- |
| `9999-99-99` | 2987 |
| `(empty)` | 8 |

### last_open_date formats

| value | count |
| --- | --- |
| `9999-99-99` | 2501 |
| `(empty)` | 494 |

### Sample unusual dates

| value | count |
| --- | --- |

### Duplicate groups

| metric | value |
| --- | --- |
| emails with >1 row | 86 |
| groups with differing status | 0 |
| groups with differing source | 0 |
| groups with differing signup_date | 0 |
| groups with differing last_open_date | 0 |
| groups differing only by email case/space | 85 |

Example groups:

```
{"email":"emily.miller827@gmail.com","signup_date":"2026-07-04","status":"active","acquisition_source":"Instagram","last_open_date":"2026-09-04"}
{"email":"EMILY.MILLER827@GMAIL.COM","signup_date":"2026-07-04","status":"active","acquisition_source":"Instagram","last_open_date":"2026-09-04"}
{"email":"  zoe.allen235@gmail.com ","signup_date":"2026-09-02","status":"active","acquisition_source":"Podcast","last_open_date":"2026-09-15"}
{"email":"zoe.allen235@gmail.com","signup_date":"2026-09-02","status":"active","acquisition_source":"Podcast","last_open_date":"2026-09-15"}
{"email":"chloe.reed603@yahoo.com","signup_date":"2026-08-12","status":"active","acquisition_source":"Instagram","last_open_date":"2026-09-20"}
{"email":"Chloe.Reed603@Yahoo.Com","signup_date":"2026-08-12","status":"active","acquisition_source":"Instagram","last_open_date":"2026-09-20"}
{"email":"Julia.stewart252@protonmail.com","signup_date":"2026-07-29","status":"active","acquisition_source":"Referral","last_open_date":"2026-09-12"}
{"email":"julia.stewart252@protonmail.com","signup_date":"2026-07-29","status":"active","acquisition_source":"Referral","last_open_date":"2026-09-12"}
{"email":"Faith.Thomas60@Protonmail.Com","signup_date":"2026-09-14","status":"unsubscribed","acquisition_source":"Referral","last_open_date":"2026-09-15"}
{"email":"faith.thomas60@protonmail.com","signup_date":"2026-09-14","status":"unsubscribed","acquisition_source":"Referral","last_open_date":"2026-09-15"}
```


## web_events.csv

Columns: `visitor_id`, `page`, `timestamp`, `utm_source`, `email`

| metric | value |
| --- | --- |
| rows | 10000 |
| distinct visitor_id | 2028 |
| rows with email | 1400 |
| distinct emails | 1400 |
| emails matching a subscriber | 1400 |
| emails NOT matching any subscriber | 0 |
| distinct pages | 16 |

### Email issues (non-empty only)

| metric | value |
| --- | --- |
| empty | 0 |
| leadingOrTrailingSpace | 0 |
| uppercase | 212 |
| noAt | 0 |
| plusAlias | 0 |
| multipleAt | 0 |
| invalidChars | 0 |

### utm_source values (raw)

| value | count |
| --- | --- |
| `(empty)` | 8030 |
| `instagram` | 667 |
| `facebook` | 496 |
| `google` | 393 |
| `referral` | 256 |
| `podcast` | 108 |
| `twitter` | 50 |

### timestamp formats

| value | count |
| --- | --- |
| `9999-99-99 99:99:99` | 10000 |

### Top pages

| value | count |
| --- | --- |
| `/` | 2691 |
| `/subscribe` | 2433 |
| `/shadrachs-picks` | 652 |
| `/about` | 537 |
| `/beliefs` | 351 |
| `/news/federal-budget-standoff` | 335 |
| `/news/what-is-happening-in-sudan` | 333 |
| `/news/ai-regulation-bill` | 333 |
| `/news/church-attendance-study` | 329 |
| `/news/housing-market-cooldown` | 322 |
| `/news/supreme-court-ruling-explained` | 321 |
| `/news/midterm-primaries-recap` | 313 |
| `/news/new-space-telescope-images` | 305 |
| `/news/hurricane-season-update` | 297 |
| `/news/world-series-preview` | 273 |
| `/our-staff` | 175 |

### Identity stitching

| metric | value |
| --- | --- |
| visitors with ≥1 email | 1400 |
| visitors with >1 distinct email (shared device?) | 0 |
| emails seen on >1 visitor | 0 |
| events on visitors that have an email (inherit link) | 8441 |


## app_users.csv

Columns: `user_id`, `email`, `created_at`

| metric | value |
| --- | --- |
| rows | 930 |
| distinct user_id | 930 |
| distinct normalized emails | 930 |
| emails matching a subscriber | 900 |
| emails NOT matching any subscriber | 30 |

### Email issues

| metric | value |
| --- | --- |
| empty | 0 |
| leadingOrTrailingSpace | 0 |
| uppercase | 94 |
| noAt | 0 |
| plusAlias | 0 |
| multipleAt | 0 |
| invalidChars | 0 |

### created_at formats

| value | count |
| --- | --- |
| `9999-99-99` | 930 |

### user_id shape

| value | count |
| --- | --- |
| `u_99999999` | 20 |
| `u_999999a9` | 6 |
| `u_99f99999` | 5 |
| `u_99999a99` | 5 |
| `u_999b9999` | 4 |
| … 821 more | |

