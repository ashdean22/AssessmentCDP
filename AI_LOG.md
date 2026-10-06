# AI_LOG — where Claude Code got it wrong

One line per correction: what it did, what was wrong, the fix.

| Date | What it did | What was wrong | Fix |
| --- | --- | --- | --- |
| 2026-10-06 | Typed the root layout with Next's generated `LayoutProps<"/">` global. | That type only exists after a local `next dev`, so `tsc` passed locally but **every CI run on GitHub failed** from the first push; nobody looked at CI for four commits. (Self-caught while checking CI before lock-down.) | Explicit `{ children: ReactNode }` in `app/layout.tsx`; check `gh run list` after every push. |
| 2026-10-06 | Removed `import "server-only"` from `lib/ai/tools.ts` and `lib/segments/run.ts` so `scripts/vapi-assistant.ts` could run under `tsx`. | Weakened the guard that stops server code (and the service-role DB client) from being bundled into the browser, to fix a tooling problem. (Self-caught on review of the diff.) | Guards restored; the script runs with `tsx --conditions react-server`, which resolves `server-only` to its empty module. |
| 2026-10-06 | Set `maxOutputTokens: 500` on the win-back draft call. | Sonnet 5.5 thinks before writing and can't have thinking disabled; 404 of the 500 tokens went to reasoning and the email was cut off mid-sentence. (Self-caught in the smoke test.) | Budget raised to 4,000 with `effort: "low"`, and a `finishReason === "length"` check that returns an error instead of a truncated draft. |
| 2026-10-06 | Wrote the npm script as `tsx --conditions react-server --tsconfig …`. | `tsx` passes unknown flags after `--conditions` to node, which rejected `--tsconfig`. | Flags reordered: `--tsconfig` first. |

