# Changelog

All notable changes to airgen are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`--fix` under TypeScript 7.** TypeScript 7 ships no JS compiler API, so the
  codemod worker had nothing to drive and failed with an obscure error. The
  daemon now detects the compiler's major version, says at startup that `--fix`
  can't run, and reports fixes as unavailable with that reason. The typecheck
  is unaffected.
- **Extensions nested in another TypeScript project.** The project-config
  lookup walked up to the filesystem root, so an extension inside a monorepo
  (or airgen's own `sandbox/`) picked up the enclosing project's `tsconfig.json`:
  no config was created on first run, the panel checked the wrong files, and
  esbuild compiled JSX with that config's `jsx` setting. The lookup now stops at
  the extension's root (the directory with `block.json`, else the nearest
  `package.json`).

## [0.4.0]

Typed relations. `useRecords(key, {include})` follows link fields into the
linked table's typed rows, derived from the schema, and every row now carries
the record's `name`.

### Added

- **`include`.** `useRecords(key, {include: {tasks: true}})` replaces the
  `{id, name}` stubs of a link cell with the linked table's typed rows; a nested
  object goes one link further (`{projects: {tasks: true}}`), two deep at most.
  Relationships are read from the schema (`linkedTableId`), so there is nothing
  to declare. A link back to a table already on the path, a key that isn't a
  link, an excess key, and a third level are compile errors; a plain-JS caller
  that gets one through is warned once and the cell is left as is. Links whose
  record isn't loaded (deleted, hidden, just created) are dropped from the
  hydrated cell. Each included key is one SDK `useRecords` on the linked table,
  made unconditionally, so the include's shape must be static per call site,
  like hook deps. `useQuery` takes the same option. See `docs/relations.md`
  and `examples/08-relations.tsx`.
- **`TableLinkMap`.** The generated file maps each table's link fields to the
  key of the table they point at, leaving out links into tables outside the
  base, and binds it as the third generic of `createTypedHooks`.
- **`record.name`.** Rows from `useRecords` are `{id, name, fields, raw}`;
  `name` is the SDK's primary-field display string. Hydrated link rows carry it
  too, so `useQuery` filters, `cellText`, and `groupRecords` match them by name.
- **Meta version 3.** Link fields record `linkedTableId`, which is also a
  signature input (retargeting a link regenerates the file). Drift and the
  daemon's diff report `link-target-changed` (breaking, not fixable; usages are
  listed under `--fix`). Metas without the key never report it, and the first
  save after upgrading is silent.

### Changed

- `createTypedHooks<M, W = M, L = object>`: a third generic, the link map. A
  two-generic binding still compiles and offers no includable links.
- The first-run stub exports an empty `TableLinkMap` and `"version": 3`.
- `BlocksSdkAdapter.useRecords` takes `SdkTable | null` and must return `null`
  for a missing table without throwing (and still call the SDK hook).

### Fixed

- **Interface extensions: a deleted or hidden generated table no longer
  throws.** The interface SDK's `useRecords` reads `table.id` unguarded, and
  `useRecords(key)` for a missing table handed it `null`. The `airgen/interface`
  adapter now wraps it (`nullSafeUseRecords`): the SDK hook still runs, on any
  table of the base, so the hook count is unchanged, and the result is `[]` as
  documented. The stable and base flavors already handled `null`.

## [0.3.2]

First-run polish for the typecheck panel: it now says what to install, and
`fix-tsconfig` covers the rest of what a fresh `block init` scaffold needs.

### Added

- **Install banner in the observer.** When `typescript` isn't installed, or the
  typecheck's errors name a missing `@types` package (tsc's own
  `Try \`npm i --save-dev @types/react\`` hint on TS7016/TS2580/TS2591, and a
  `types` entry with no package behind it, TS2688), a banner above the strip
  lists the packages and the install command, with a Copy button. The command is
  spelled for the project's package manager (`packageManager` field, then the
  lockfile) and printed in the daemon's terminal too. It rides on a new optional
  `install` key on `GET /diagnostics`. The daemon now watches `package.json`, so
  the install itself triggers the recheck and the banner clears on its own.
- **`fix-tsconfig` covers more.** `jsx` for JSX in plain `.js` files (how
  `block init` writes it), a `lib` that leaves out `DOM`, and under TypeScript 6
  or newer `"noUncheckedSideEffectImports": false`, since the compiler now
  checks side-effect imports by default and the scaffold's `import
  './style.css'` fails with TS2882. The recommended config airgen creates
  carries that key when the project's TypeScript is 6+.
- **`<SchemaObserver>` accepts children.** Wrapping the app in it instead of
  rendering it as a sibling used to be a type error (`children` does not exist
  on `SchemaObserverProps`). Children now render below the panel, and alone
  when `enabled` is false.

### Changed

- Multi-line tsc messages (related detail, install hints) are reported and
  shown whole; previously only the first line survived.

## [0.3.1]

First-run fixes: a fresh extension now bundles before the first sync, and the
typecheck panel tells you when your tsconfig hides your code from it.

### Fixed

- **First run no longer deadlocks.** An extension that imports
  `./airtable-schema` failed to bundle until that file existed, so
  `<SchemaObserver />` never ran and the file was never written. When the
  output file doesn't exist yet, `npx airgen` now writes a placeholder (header,
  empty `airgenMeta`, empty `TableRecordMap`/`TableWriteMap`) that the
  observer's first sync replaces. An existing file is never overwritten. The
  placeholder doesn't export the hooks; import those after the first sync.

### Added

- **`npx airgen fix-tsconfig`.** Creates the recommended `tsconfig.json`, or
  fixes the one the typecheck uses: an `include` that misses the sources
  (TS18003), missing `allowJs` or `jsx`, and `NodeNext` resolution. A config
  with comments is backed up to `.bak` first. With no config at all, `npx airgen`
  creates the recommended one at startup. The typecheck still uses the
  project's own `typescript`, and a JavaScript extension under the recommended
  `checkJs` + `strict` needs `@types/react`; airgen installs neither.
- **tsconfig banner in the observer.** When the config needs changes, a banner
  above the strip lists them with the `fix-tsconfig` command and a Copy button.
  It comes from a new optional `config` key on `GET /diagnostics`, and the daemon
  rechecks whenever the config file changes.

## [0.3.0]

Runtime expansion. The generated file gains write
types and a richer meta, an SDK-free runtime core lands behind it, the
generated hooks bind it, and `examples/` shows all of it. One breaking type
change on regeneration: lookup cells (see Changed). Upgrade notes in
`docs/upgrading.md`.

### Changed

- **Lookup read types match the SDK.** `multipleLookupValues` fields are now
  `Array<LookupValue<Result>>` (`{linkedRecordId, value}` per entry, the SDK's
  documented cell read format) instead of `Array<Result>`, which never matched
  what `getCellValue` returns. Code that treated lookup entries as bare values
  now fails to compile: read `entry.value`, or use the runtime's
  `lookupValues()`.

### Added

- **`examples/`**: commented `.tsx`/`.ts` files covering setup, reading,
  fields, writes, queries, drift, custom properties, and the runtime outside
  React, written against the generated file of a generic project-tracker base
  (`test/fixtures/example-base.js`). Typechecked by the `tsc --strict` compile
  test, never shipped.
- **`<Table>Write` interfaces and `TableWriteMap`.** One write interface per
  table, holding only writable fields, each typed with the SDK's documented
  **cell write format** (`field_core.d.ts`): scalars admit `null` to clear,
  dates take `string | Date`, selects take `{id} | {name}` with literal unions
  indexed off the read alias (`{ id: ProjectsStatusChoice['id'] }`),
  collaborators `{id}`, links `{id; name?}`, attachments `{url; filename?}` or
  the read shape. Computed fields are omitted (not `never`), so the interface
  doubles as the partial update payload. On `airgen/interface` links also admit
  a bare `{name}` (create-and-link); `GeneratorOptions.sdkFlavor` controls
  this and defaults from `hooksModule`. Barcode has no SDK write format and is
  omitted too.
- **Meta v2.** `airgenMeta.version` is `2`; each field records `isComputed`
  (the SDK's `Field.isComputed`) and each table `primaryFieldId`. Both keys are
  spread conditionally, so a schema source without them yields no key, and the
  runtime types keep them optional so version-1 files still typecheck. Neither
  is a signature input.
- **`aiText` and `externalSyncSource` read types** (`AiText`, `SelectChoice`)
  instead of `unknown`.
- **Drift: `field-became-computed`** (breaking) when a field the meta recorded
  as writable is computed in the live base. Only fires for v2 metas.
- **Hooks: `useFields`, `useMutations`, `useQuery`.** The generated file now
  ends with `export const {useRecords, useTable, useSchemaDrift, useFields,
  useMutations, useQuery} = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta)`.
  `useMutations('Projects')` is a `MutableTable<ProjectsWrite>` (field keys and
  write values typed, stable across renders); `useFields` an inspector per
  field key; `useQuery(key, spec)` is `query(useRecords(key), spec)`, not
  memoized, because the SDK keeps the records array when only cell values
  change. Regenerating is additive: existing imports keep working.
- **Custom properties (interface SDK).** `createTypedHooks(airgenMeta,
  {customProperties: {Deals: 'Deals table'}})` registers a table picker per
  listed table (defaulting to the generated table, keyed by its ID so renames
  keep the pick). A picked table other than the generated one is matched by
  field name, then primary field, and every hook reads and writes it by its own
  IDs. A field with another type there blocks all writes to the table (and
  reads as absent); a missing field is a warning. On the stable and base
  flavors the option falls back to the generated tables with a
  `custom-properties-unsupported` warning.
- The runtime is exported from every entry point: `createMutations`,
  `inspectField`/`FieldInspector`, `cloneValues`, `query`/`groupRecords`/
  `cellText`/`containsMatcher`, the normalize helpers, `ValidationResult`,
  `resolveTableOverride`/`findTable`, `tableCustomProperties`/`customPropertyKey`.
- **SDK-free runtime core** (`src/client/runtime/`):
  - `createMutations<Write>(table, tableMeta)`: `create`, `createMany`,
    `update`, `updateFields`, `updateMany`, `remove`, `removeMany`, `clone`,
    `inspect`, `can.create/update/delete`. Keys resolve by meta ID, values go
    through `convertTo`, and every write validates, then permission-checks
    every batch of 50, before the first SDK call. Results are
    `{ok: true, ids, issues}` or `{ok: false, error, ids, failedBatch, issues}`,
    where a failure's `ids` are the records already committed. Never throws;
    a missing table or field fails the write, never the render.
  - `FieldInspector` / `inspectField`: live-or-meta type, choices (lookups and
    formulas unwrap `options.result`), `isWritable`, and an idempotent
    `convertTo` from read shapes to cell write formats.
  - `ValidationResult`: blocking errors (unknown, hidden, retyped, or computed
    field; missing table) vs warnings (field type airgen doesn't know).
  - `cloneValues`: a record's writable, non-empty cells in write shapes.
  - `query` / `groupRecords` over `useRecords` rows: `is`/`not`/`anyOf`/
    `noneOf`/`empty`/`notEmpty` filters (selects, links, and collaborators
    match by id, name, or email), all/any matching, search with an injectable
    `SearchMatcher` (default: accent- and case-insensitive token match — no
    fuse.js dependency), and multi-field grouping.
  - `lookupValues`, `firstLookupValue`, `cellIds`, `cellNames`,
    `firstLinkedRecord` read helpers.

### Docs

- README cut down to the consumer story (quick start, what you get, the
  runtime with a link per example, upgrade notes, API table). The deep guides
  moved to `docs/`: `generated-file.md`, `typecheck-and-fixes.md`,
  `cli-and-daemon.md`, `upgrading.md`, `releasing.md`.

### Internal

- `field-types.ts` holds the per-type write kinds that both the generator's
  `resolveWriteType` and the runtime's `convertTo` switch on, so the emitted
  write type and the converted value come from one table. Generated output is
  unchanged (the snapshot is byte-identical). `deaccent` moved to its own
  module, shared by the generator and the default search matcher.
- `sdk.ts`: `SdkField` gains optional `name`/`type`/`options`/`isComputed`,
  `SdkRecord` gains `getCellValueAsString`, and `SdkTable` gains `fields`,
  `primaryField`, the batch write and `checkPermissionsFor*` methods. The
  stable SDK's classes still satisfy them. `BlocksSdkAdapter` gains optional
  `useMemo` (React's, bound by every entry point) and `useCustomProperties`
  (interface only), so `useTypedRecords.ts` imports neither React nor the SDK
  and the hooks run under a plain-function test adapter.
- `createMutations` takes `{validation}` (table-level issues that refuse every
  write) and exposes it as `MutableTable.validation`.
- Root toolchain: ESLint 10 (flat, `typescript-eslint`, `react-hooks`) and
  Prettier 3 (2-space, single quotes, no bracket spacing, width 120); the whole
  tree is formatted. `npm run check` = typecheck + lint (`--max-warnings 0`) +
  `format:check` + tests, and is what `prepublishOnly` runs. `@types/react` is
  `^19` to match `react`. `plan/` and
  `packages/` are excluded from root lint/format.
- Tests: a golden snapshot of the fixture's generated file
  (`test/fixtures/snapshots/`, refresh with `UPDATE_SNAPSHOTS=1`), and
  consumer-style `@ts-expect-error` fixtures (`test/fixtures/consumers/`)
  compiled by the `tsc --strict` test for both the stable and interface
  flavors. `mock-base.js` derives `isComputed`/`primaryField` the way the SDK
  reports them. Runtime tests (`test/runtime-*.test.js`) run against
  structural fakes (`test/fixtures/fake-sdk.js`), and `entries.test.js` pins
  that nothing under `runtime/` imports a non-relative module. Suite is 146
  tests.

## [0.2.6]

### Added

- **`airgenMeta` now carries select choice colors.** Each choice in the meta is
  `{id, name, color?}` in Airtable's display order, so UI layers (the upcoming
  `@airgen/ui`) can render Airtable-colored pills straight from the generated
  metadata without using names as identifiers. The `color` key is spread
  conditionally — colorless choices carry no key at all, keeping the in-memory
  meta and the emitted JSON the same shape. Colors never change the emitted
  *type* (choice unions still end in `color?: string`), and drift and the
  codemod diff still compare choices by id/name only, so a recolor regenerates
  the file silently: no drift warning, no fix prompt.
- **`airgenMeta.version`.** The meta object now leads with `version: 1` so
  future consumers can detect the meta format. `AirgenMeta.version` is optional
  in the runtime types, so files generated by older versions still typecheck.

### Internal

- Signature tests now pin color-sensitivity explicitly (a recolor changes the
  signature — behavior that existed but was unasserted), and drift/diff tests
  pin the inverse: a recolor is never drift, and upgrading an old colorless
  generated file to a color-carrying one diffs as zero changes, so the first
  save after upgrading spawns no codemod work. Suite is 94 tests.

## [0.2.5]

### Fixed

- **Generated output is deterministic again.** `airgenMeta` carried a
  `generatedAt` timestamp, so every generation produced a different file even
  when the schema was unchanged. The daemon skips a write only when the payload
  matches the file byte-for-byte, so that timestamp defeated the dedup and turned
  each save into a write → hot-reload → remount → regenerate loop. The field is
  no longer emitted.

### Changed

- `GeneratedMeta.generatedAt` is gone; `AirgenMeta.generatedAt` is now optional,
  so files generated by older versions still typecheck against the new runtime.

### Internal

- New test: the same schema generates byte-identical code across two runs
  (`generator.test.js`), with a deliberate clock tick between them so a
  same-millisecond fluke can't mask a reintroduced timestamp.

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
