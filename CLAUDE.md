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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
