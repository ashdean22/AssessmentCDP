# TPO Mini CDP

Read `PLAN.md` fully before any task. The assessment brief is `docs/TPO_Developer_Assessment.pdf`; it wins if the two disagree.

Hard rules (from PLAN.md §11):
- `normalizeEmail()` in `lib/normalize.ts` is the only email normalizer. Never write another.
- All business-logic time math uses `REFERENCE_DATE` (2026-09-28) from `lib/config.ts`, never the real clock.
- The AI never receives emails, names or raw rows. Tools return aggregates or masked IDs, and every tool output passes `lib/pii/guard.ts`.
- The model never writes SQL. Segment filters go through `lib/segments/compile.ts` (allowlisted fields, parameterized).
- Every feature ships with Vitest tests; run `npm test` before each commit.
- Inspect `DATA_NOTES.md` before writing data logic.
- No silent TODOs: list every stub/mock/hardcoded value in README "Known limitations".
- When corrected, append a line to `AI_LOG.md`.

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run profile`, `npm run import`.
