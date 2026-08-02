# Changelog

All notable changes to airgen are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4]

### Added

- **Typechecking and assisted fixes now work in plain-JavaScript extensions.**
  Both features locate the consumer project by walking up from the output file;
  that walk accepted only `tsconfig.json`, which a JS extension doesn't have. It
  now accepts `jsconfig.json` too (same format, `allowJs` implied by
  TypeScript), preferring `tsconfig.json` when a directory has both. `.js` and
  `.jsx` are analysed and rewritten exactly as `.ts` is.
- `jsconfig.json` implies `allowJs` but **not** `checkJs`, so a JS project that
  wants the typecheck panel to report on its own files has to set
  `"checkJs": true`. Fixes are unaffected by that setting. Documented in the
  README.

### Fixed

- The codemod worker forced `allowJs` *after* parsing the project config, but
  `parseJsonConfigFileContent` resolves the file list from the options it is
  given — so the program contained no `.js` files at all unless the config
  itself enabled `allowJs`, and renames silently missed them. It is now passed
  as `existingOptions`, along with the config path so jsconfig's implied
  defaults apply.

### Internal

- `findTsconfig` → `findProjectConfig`, with `PROJECT_CONFIG_NAMES` /
  `PROJECT_CONFIG_LABEL` (`typecheck.js`); the codemod job field `tsconfigPath`
  → `configPath`. Diagnostics that have no file position are now attributed to
  the config file that actually drove the check, not a hardcoded
  `tsconfig.json`.
- New tests: a plain-JS consumer project driven by `jsconfig.json` gets its
  renames applied (`codemod.test.js`), and a `jsconfig.json` project is
  typechecked (`diagnostics.test.js`). Suite is 89 tests.

## [0.2.3]

Three layers of "the schema changed, now what?": detect the drift, typecheck the
damage, and offer to fix the code.

### Added

#### Schema drift detection

- **`useSchemaDrift()`** — exported by the generated file alongside `useRecords`
  and `useTable`. Compares the live base against the `airgenMeta` baked into the
  file, **by ID**, and returns a `DriftReport` (`{ok, findings, counts}`). Safe in
  released extensions: pure reads, no daemon, reactive only on schema mutations.
  Deleted tables/fields and type changes are `breaking`, removed or renamed select
  choices are `warning`, renames are `info`; additions in the base are never drift.
- **`checkSchemaDrift(base, airgenMeta)`** — the pure function behind the hook,
  exported from `airgen`, `airgen/interface`, and `airgen/base`, along with the
  `DriftReport` / `DriftFinding` / `DriftSeverity` / `DriftKind` / `DriftMetaLike`
  / `DriftChoicesLike` / `DriftResultMetaLike` types.
- **`<SchemaObserver meta={airgenMeta} />`** — new optional `meta` prop. When
  given, the dev panel shows a collapsible drift summary
  (`drift: 2 breaking · 1 renamed`).

#### Consumer typechecking

`block run` transpiles with Babel and never typechecks, so a schema change that
broke your code previously failed silently at runtime.

- After every schema write (and once at startup) the daemon typechecks the whole
  consumer project using **the project's own `typescript`**, in a child process.
  Nothing is bundled; if `typescript` or a `tsconfig.json` is absent the feature
  reports `unavailable` and stays out of the way.
- **`GET /diagnostics`** serves the result:
  `{status: 'ok'|'errors'|'checking'|'unavailable', errors, total, checkedAt}`.
  Paths are project-relative and the absolute cwd is scrubbed from messages.
- The observer polls it after each sync and shows `✓ types ok` / `✗ N type errors`
  with the first few errors expandable.

#### Assisted code fixes (opt-in: `npx airgen --fix`)

- The daemon diffs the previous generated file against the new one **by ID**, so a
  rename is an exact fact rather than a guess, then locates the affected code with
  the TypeScript language service and offers one-click fixes:

  | Change | Behaviour |
  |---|---|
  | Field renamed | rewrites `record.fields.contactEmail` → `.customerEmail`, including destructuring, in `.ts` **and** `.js` |
  | Table renamed | rewrites `useRecords('Projects')` and the `ProjectsRecord` type |
  | Choice renamed | rewrites `status?.name === 'Todo'` → `=== 'Backlog'` |
  | Generated type renamed | rewrites `ProjectsRecord`, `ProjectsStatusChoice`, … where imported |
  | Field/table **deleted** | lists every usage as `file:line`; no automatic fix |
  | Field **type changed** | same — the value's shape changed, so the call is yours |

- String literals are rewritten only where the type checker confirms what they
  are; an unrelated `const label = 'Todo'` is never touched. When the checker
  can't confirm, the edit is skipped and left to the typecheck panel —
  under-fixing is the intended failure mode.
- **`GET /fixes`** and **`POST /apply-fix`** (`{id}` or `{all: true}`), both 404
  unless `--fix` is set. Applied edits are logged to the terminal and the project
  is re-typechecked immediately. Undo is git.
- **`--fix` CLI flag** and **`"fix": true`** in `airgen-config.json`.
- The panel lists pending changes with **Apply** / **Fix all** buttons, and shows
  usage lists for changes that have no mechanical fix.

### Changed

- **`airgenMeta` now records the full type-relevant projection of each field.**
  `resolveFieldType` reads exactly two things off `field.options` — `choices` and
  `result` — but the meta only recorded `choices`. A formula whose `result` went
  `number → string` therefore regenerated the file while reporting no drift. Per
  the SDK's `field_core.ts`, `result` is a recursive `FieldConfig`, so a lookup of
  a select carries that select's choices; those are now recorded and compared too.
- **`AirgenFieldMeta.choices` changed shape** from `{[choiceName]: choiceId}` to
  `Array<{id, name}>`. The object form lost duplicate choice names and could not
  express a rename. Nothing reads `choices` at runtime, so this affects only code
  that inspected the meta directly. **Previously generated files keep working** —
  both shapes are accepted by the drift and diff paths.
- The generated file's final line is now
  `export const {useRecords, useTable, useSchemaDrift} = createTypedHooks<TableRecordMap>(airgenMeta);`
- `startDaemon` accepts `cwd` (defaults to `process.cwd()`, so existing behaviour
  is unchanged) and `fix`.
- `airgen-config.json` gained the `fix` key; the unknown-key error now lists
  `out, port, fix`.

### Internal

- `generateTypeScriptFromBase` split into a pipeline — `planTables` →
  `buildMetaFromPlan` → `emitTable` → assemble — with `createAliasRegistry`,
  `aliasDeclaration`, `fieldDocLine`, and `fileHeader` extracted. Output is
  byte-identical.
  - This removed a real hazard: the emitter and `buildAirgenMeta` previously
    derived the sanitized keys through two parallel `uniqueNames`/`camelCase`
    passes kept in step only by a comment. The runtime builds `record.fields`
    from the meta keys while the interface declares the property names, so a
    divergence would have produced a file that compiles but reads `undefined`.
    Both now consume one `TablePlan`.
- New modules: `src/daemon/schema-diff.js` (pure, by-ID diff of two generated
  files), `src/daemon/codemod.js` (pending fixes, guards, apply),
  `src/daemon/codemod-worker.js` (language-service analysis in a child process).
- New tests: `test/schema-diff.test.js` (fast, pure) and `test/codemod.test.js`
  (end-to-end against a temp consumer project, deliberately including a plain
  `.js` file). Suite is 87 tests.
- CLAUDE.md documents the coupling as three-way: whatever `resolveFieldType`
  reads must be captured by `relevantOptions`, recorded by `buildFieldTypeMeta`,
  and compared by `checkSchemaDrift` / `diffGeneratedFiles`.

### Security

The codemod is the only capability that writes outside the fixed output path, so
it is gated deliberately:

- it does not exist without `--fix` — both endpoints 404 and no analysis runs;
- `POST /apply-fix` accepts an id (or `{all: true}`) and nothing else — edits and
  paths are never taken from the request, only recomputed by the daemon;
- every edit must resolve inside the tsconfig project root, carry an allowlisted
  source extension, and never target the generated file;
- pending fixes are single-use and expire after 10 minutes;
- a file edited after the analysis ran makes the apply fail with `409` rather than
  writing at stale offsets;
- applying a subset **drops** every remaining fix touching a rewritten file, since
  edits from one analysis are only offset-consistent with each other.

`GET /diagnostics` and `GET /fixes` are pure state reads that never trigger work
and report only cwd-relative paths.

## [0.2.1]

- Per-SDK-flavor entry points (`airgen`, `airgen/interface`, `airgen/base`) so
  interface extensions bundle correctly.
- `airgen-config.json` support for `out` and `port`.
- Schema drift reported from the generated file's baked-in meta.
