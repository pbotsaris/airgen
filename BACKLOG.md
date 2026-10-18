# Backlog

Known issues and planned improvements that aren't scheduled yet. One section per item: **Problem** (what broke and where it was seen), **Fix** (the intended approach and its open questions), plus the tests and docs it touches. When an item ships, delete it here and record it in `CHANGELOG.md`.

## 1. Codemod under TypeScript 7

**Problem.** `--fix` drives the consumer's `typescript` language service in `codemod-worker.js`, and TypeScript 7 (the native port) ships no JS compiler API. Since the fix for this, the daemon detects TS ≥ 7 and reports `--fix` as unavailable with that reason, so a TS 7 project (`afsp_profit_loss`) gets typechecking but no assisted fixes.

**Fix.** Drive TS 7's `typescript/unstable/sync` API. It has symbols and per-file references (`getSymbolAtPosition`, `getReferencesToSymbolInFile`, `getReferencedSymbolsForNode`) but no `findRenameLocations`, and it reads files from disk, while the worker serves the *previous* generated file as an in-memory overlay (see `unstable/fs` for a virtual filesystem). Wait until the API stops being `unstable`, or accept rewriting the worker against it. Alternative: let a consumer point `--fix` at a `typescript@5` installed alongside under an alias. Tests: the existing codemod suite, run against the TS 7 backend. Docs: `docs/typecheck-and-fixes.md`.

## 2. Duration rounding in `format`

**Problem.** `formatValue` (`src/client/runtime/format.ts`, `formatDuration`) rounds a duration to the format's last unit: `h:mm` shows 5432.567 s as `1:31`, and `h:mm:ss.S` rounds the tenths. Whether Airtable's grid rounds or truncates there hasn't been checked, so a formatted total can disagree with the cell by one minute or one tick.

**Fix.** Compare against the grid in a real extension (the sandbox) for each `durationFormat`, at values just below and above a unit boundary (89.9 s, 90 s, 5459.99 s), and switch `formatDuration` to `Math.floor` on the absolute value if Airtable truncates. Tests: the duration cases in `test/runtime-format.test.js`, plus the round-trip case. Docs: the duration row in `docs/formatting.md` if the behavior changes.

## 3. `@airgen/ui` borders depend on the consumer's CSS reset

**Problem.** `packages/ui/tailwind.config.cjs` disables preflight so the package never restyles the host, but preflight is also what sets `border-style: solid; border-width: 0` on every element. The compiled CSS only emits width and color utilities (`ag-border-b`, `ag-border-t-2`, `ag-border-neutral-200`), so in a page without an equivalent reset no `Table`, `TableRow`, `GroupTable` or `Divide` border renders at all; `.ag-column-lines` is the one rule that spells out `1px solid`. Seen on 2026-10-18 in a plain Vite page rendering the `GroupTable` examples: row separators and the depth-0 group border were invisible until `*, ::before, ::after {border-style: solid; border-width: 0}` was added by hand. The `block init` scaffold ships Tailwind with preflight, which is why the sandbox and real extensions look right.

**Fix.** Make the package's own CSS self-sufficient without touching host elements: in `src/styles.css` add a scoped reset such as `[class*="ag-border"] {border-style: solid; border-width: 0}` (the width utilities then set the sides they name, as they do under preflight), or emit `border-style` alongside each width utility via a small plugin in `tailwind.config.cjs`. Open question: whether `::before`/`::after` pseudo-elements with `ag-border` classes (the resize handle's `after:ag-w-px` line uses a background, so probably none) need covering. Tests: a jsdom test cannot see computed borders, so pin the stylesheet instead: assert that `dist/styles.css` contains the reset rule (in `test/prefix.test.tsx` or a new `styles.test.ts`). Docs: a line in `packages/ui/README.md` Styling saying no Tailwind reset is required.
