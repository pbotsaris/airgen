# Backlog

Known issues and planned improvements that aren't scheduled yet. One section per item: **Problem** (what broke and where it was seen), **Fix** (the intended approach and its open questions), plus the tests and docs it touches. When an item ships, delete it here and record it in `CHANGELOG.md`.

## 1. Codemod under TypeScript 7

**Problem.** `--fix` drives the consumer's `typescript` language service in `codemod-worker.js`, and TypeScript 7 (the native port) ships no JS compiler API. Since the fix for this, the daemon detects TS ≥ 7 and reports `--fix` as unavailable with that reason, so a TS 7 project (`afsp_profit_loss`) gets typechecking but no assisted fixes.

**Fix.** Drive TS 7's `typescript/unstable/sync` API. It has symbols and per-file references (`getSymbolAtPosition`, `getReferencesToSymbolInFile`, `getReferencedSymbolsForNode`) but no `findRenameLocations`, and it reads files from disk, while the worker serves the *previous* generated file as an in-memory overlay (see `unstable/fs` for a virtual filesystem). Wait until the API stops being `unstable`, or accept rewriting the worker against it. Alternative: let a consumer point `--fix` at a `typescript@5` installed alongside under an alias. Tests: the existing codemod suite, run against the TS 7 backend. Docs: `docs/typecheck-and-fixes.md`.
