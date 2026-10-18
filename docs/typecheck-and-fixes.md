# Typechecking and fixing your code

## Typecheck panel

`block run` transpiles with Babel and never typechecks, so a schema change that breaks your code would otherwise fail silently at runtime. After every schema write (and once at startup) the daemon typechecks your whole project using **your project's own `typescript`**. Nothing is bundled; if it isn't installed, the feature reports "unavailable". It finds the nearest `tsconfig.json` or `jsconfig.json` at or above the output file and runs `tsc --noEmit` in a child process, so the daemon never blocks.

Results are served at `GET /diagnostics` and shown in the observer panel after each sync (`✓ types ok` / `✗ 3 type errors`, expandable to the first few errors with file and line):

```json
{
  "status": "ok | errors | checking | unavailable",
  "errors": [{"file": "frontend/index.tsx", "line": 12, "col": 5, "code": "TS2322", "message": "…"}],
  "total": 1,
  "checkedAt": "2026-08-02T18:03:11.412Z"
}
```

Paths are project-relative, never absolute.

## Fixing your code when the schema changes

Renaming a field in Airtable regenerates your types instantly, but every `record.fields.contactEmail` in your code is now stale. Start airgen with `--fix` and it offers to rewrite them:

```sh
npx airgen --fix          # or {"fix": true} in airgen-config.json
```

On each schema write the daemon diffs the previous generated file against the new one **by ID**, so a rename is an exact fact (`fldEmail000000001` was `contactEmail`, is now `customerEmail`) rather than a guess. It then locates the affected code with the TypeScript language service and shows it in the panel, with an **Apply** button for anything it can rewrite mechanically:

| Change | What happens |
|---|---|
| Field renamed | `record.fields.contactEmail` → `.customerEmail`, including destructuring, across `.ts` and `.js` |
| Table renamed | `useRecords('Projects')` → `useRecords('Projekte')`, plus the `ProjectsRecord` type |
| Select choice renamed | `status?.name === 'Todo'` → `=== 'Backlog'` |
| Generated type renamed | `ProjectsRecord`, `ProjectsStatusChoice` and friends where you import them |
| Field or table **deleted** | Listed with every usage as `file:line`; no automatic fix, the data is gone |
| Field **type changed** | Same: the value's shape changed, so only you can decide what the code should do |

String literals are rewritten only when the type checker confirms what they are; an unrelated `const label = 'Todo'` is never touched. When it can't confirm, it skips and leaves the error for the typecheck panel. Under-fixing is the intended failure mode.

Applied edits are printed to the terminal and the project is re-typechecked immediately, so the panel confirms the fix landed. **Undo is git**: these are ordinary dev-loop edits, like an editor refactor.

This is the one feature that writes outside the generated file, so it exists only under `--fix`. Edits are confined to your project directory and to source extensions, a pending fix is single-use, and if you edit a file after the analysis ran the apply is refused rather than applied at stale offsets.

## If your extension is JavaScript

Both features are driven by TypeScript, but your code doesn't have to be. A `jsconfig.json` next to (or above) the generated file is enough; TypeScript reads it with `allowJs` implied:

```json
{
  "compilerOptions": {"target": "es2020", "moduleResolution": "bundler", "checkJs": true},
  "include": ["frontend"]
}
```

`.js` and `.jsx` files are analysed and rewritten exactly like `.ts`; the generated file is still TypeScript, and your editor picks up the types from it either way. One asymmetry: `jsconfig.json` implies `allowJs` but **not** `checkJs`, so without `"checkJs": true` the typecheck panel has nothing to report on your `.js` files and will say "types ok". Fixes work regardless of that setting.
