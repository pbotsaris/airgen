# Backlog

Known issues and planned improvements that aren't scheduled yet. One section per item: **Problem** (what broke and where it was seen), **Fix** (the intended approach and its open questions), plus the tests and docs it touches. When an item ships, delete it here and record it in `CHANGELOG.md`.

## 1. Codemod under TypeScript 7

**Problem.** `--fix` drives the consumer's `typescript` language service in `codemod-worker.js`, and TypeScript 7 (the native port) ships no JS compiler API. Since the fix for this, the daemon detects TS ≥ 7 and reports `--fix` as unavailable with that reason, so a TS 7 project (`afsp_profit_loss`) gets typechecking but no assisted fixes.

**Fix.** Drive TS 7's `typescript/unstable/sync` API. It has symbols and per-file references (`getSymbolAtPosition`, `getReferencesToSymbolInFile`, `getReferencedSymbolsForNode`) but no `findRenameLocations`, and it reads files from disk, while the worker serves the *previous* generated file as an in-memory overlay (see `unstable/fs` for a virtual filesystem). Wait until the API stops being `unstable`, or accept rewriting the worker against it. Alternative: let a consumer point `--fix` at a `typescript@5` installed alongside under an alias. Tests: the existing codemod suite, run against the TS 7 backend. Docs: `docs/typecheck-and-fixes.md`.

## 3. `@airgen/ui` dark mode: verify, and bind it per flavor

**Problem.** `ThemeProvider` now lets a consumer pin the components to Airtable's theme (`useColorScheme`), but two things are unsettled. It's unverified whether Airtable sets the frame's `prefers-color-scheme` from its own theme or just passes the OS setting through (in `sandbox/` the media query reported dark on a white frame, but the scaffold paints its own background, so that run doesn't settle it). And a consumer has to wire the provider by hand.

**Fix.** In the sandbox, set Airtable and the OS to different themes and log what `useColorScheme` and `matchMedia('(prefers-color-scheme: dark)')` each report. If they always agree, the provider is optional and the README can say so. Either way, the Phase 4 per-flavor entries should bind the provider to `useColorScheme` so consumers get it for free. Open question: whether components should paint their own surfaces (`Table`, `Popover` already do) or leave the page background to the consumer, as the scaffold does (the current README says the latter). Docs: `packages/ui/README.md`.
