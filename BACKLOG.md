# Backlog

Known issues and planned improvements that aren't scheduled yet. One section per item: **Problem** (what broke and where it was seen), **Fix** (the intended approach and its open questions), plus the tests and docs it touches. When an item ships, delete it here and record it in `CHANGELOG.md`.

## 1. Bootstrap stub on first run

**Problem.** The quick start has the consumer write `import {airgenMeta} from './airtable-schema'`, but that file exists only after the first generation. On a fresh project the bundle fails (`Could not resolve "./airtable-schema"`), so the extension never loads, `<SchemaObserver />` never connects, and the file is never written. The startup typecheck reports the same missing import. Hit in `afsp_profit_loss` on 2026-10-17.

**Fix.** At startup, if the output file does not exist, write a minimal stub so the first bundle succeeds. The observer overwrites it once it connects.

- The stub must start with `GENERATED_HEADER` (the daemon's `REQUIRED_HEADER` check) and export an empty `airgenMeta` (`version: META_VERSION`, no tables) that typechecks as `meta={airgenMeta}`.
- Decide whether it also exports the pre-bound hooks (`useRecords`, …) bound to the empty meta, so a consumer who already imports them still bundles. Leaning yes: same export surface, no tables.
- Never overwrite an existing file. Only write when the path is missing.
- Placement: `startDaemon` already `mkdirSync`s the output dir, so writing the stub there is defensible, but CLAUDE.md wants `startDaemon` free of side effects beyond that. Consider the bin, or an explicit `bootstrap` option. Daemon tests must not start writing stubs into temp dirs unexpectedly.
- Under `--fix`: stub → first real file must diff as pure additions (no fixes offered). Add a `schema-diff` test.
- The stub must not show up as drift in `useSchemaDrift` (empty meta → no drift).
- Docs: `docs/cli-and-daemon.md` (first-run behavior). The README quick start can then keep the import as written.

## 2. Recommended tsconfig

**Problem.** The daemon's typecheck runs `tsc` on whatever `tsconfig.json`/`jsconfig.json` `findProjectConfig` finds. A config that doesn't cover the extension's sources gives a useless result. In `afsp_profit_loss`, `include: ["src/**/*.js"]` with code in `frontend/` gave `TS18003: No inputs were found in config file`. A `.js`-only include also misses `.jsx` and the generated `.ts`, and `module`/`moduleResolution: NodeNext` rejects the extensionless imports the blocks bundler accepts.

**Recommended config** (blocks scaffold, sources in `frontend/`):

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

`include` should be derived from the output path's directory, not hard-coded.

**Fix.**

- **No config found** (no tsconfig/jsconfig up to the project root): create the recommended one and log that it did.
- **Config found but wrong:** don't edit it. Prompt the user with what to change:
  - TS18003 / no inputs → `include` doesn't cover the extension sources;
  - the generated file isn't in the program;
  - `.jsx`/`.tsx` sources present but no `jsx` option;
  - `NodeNext`/`Node16` resolution with extensionless relative imports → suggest `Bundler`.
- Where: creating a file in the consumer's project is a process-level side effect, so it goes in `bin/airgen.js` (interactive prompt when TTY, plain log otherwise), not `startDaemon`. The inspection itself can live next to `findProjectConfig` in `typecheck.js` so the observer panel can show the same hints via `/diagnostics`.
- Tests: bin test for create-when-missing (temp `cwd`), diagnostics test for each "wrong config" hint, and the jsconfig path.
- Docs: `docs/typecheck-and-fixes.md`.
