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

## Your tsconfig

The panel is only as good as the config `tsc` runs with. airgen checks it on every typecheck and, when it won't describe your extension, shows a yellow banner above the strip that names the problems and gives you the command to fix them, with a **Copy** button:

```sh
npx airgen fix-tsconfig          # pass the same -o as your daemon if the output isn't the default
```

It catches:

| Problem | What `fix-tsconfig` does |
|---|---|
| `include` misses the folder with your sources and the generated file (tsc says "No inputs were found", TS18003) | appends that folder to `include` |
| `.js`/`.jsx` sources but no `allowJs` (they're silently left out of the check) | sets `"allowJs": true` (never in a `jsconfig.json`, which implies it) |
| `.jsx`/`.tsx` sources but no `jsx` option | sets `"jsx": "react-jsx"` |
| `NodeNext`/`Node16` resolution, which requires file extensions on relative imports that the blocks bundler doesn't need | sets `"module": "ESNext"`, `"moduleResolution": "Bundler"` |

Every other key is kept. If the file had comments, the rewrite drops them, so the original is saved next to it as `tsconfig.json.bak`. A config that extends another is read for its own keys only; a key `fix-tsconfig` adds overrides the inherited one. An `exclude` that hides your sources is reported, not rewritten. The command runs in your terminal; the daemon only reads the config, and it rechecks as soon as the file changes, so the banner clears on its own.

With no config at all, `npx airgen` creates this one at startup, with `include` set to the output file's folder:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["frontend"]
}
```

`checkJs` with `strict` checks JSX against React's types, so a JavaScript extension needs `@types/react` installed (`npm install --save-dev @types/react`) or every element reports an implicit `any`.

`GET /diagnostics` carries the banner's data as an optional `config` key, absent when there's nothing to fix:

```json
{"config": {"file": "tsconfig.json", "command": "npx airgen fix-tsconfig", "issues": ["\"include\" doesn't cover frontend/"]}}
```

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
