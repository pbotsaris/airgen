# Backlog

Known issues and planned improvements that aren't scheduled yet. One section per item: **Problem** (what broke and where it was seen), **Fix** (the intended approach and its open questions), plus the tests and docs it touches. When an item ships, delete it here and record it in `CHANGELOG.md`.

## 1. Codemod under TypeScript 7

**Problem.** `--fix` loads the consumer's `typescript` in `codemod-worker.js` and drives its language service. TypeScript 7 (the native port) ships no JS compiler API: `require('typescript')` resolves to `lib/version.cjs`, so the worker has nothing to call. `afsp_profit_loss` is on `typescript@^7.0.2`. The typecheck still works, because it only spawns `lib/tsc.js`.

**Fix.** Not decided. Options: detect TS ≥ 7 and report `--fix` as unavailable with a clear reason (the minimum); drive TS 7's `typescript/unstable/sync` API; or fall back to a `typescript@5` the consumer installs alongside. Tests: a codemod test with a fake TS-7-shaped package that asserts the unavailable reason. Docs: `docs/typecheck-and-fixes.md`.
