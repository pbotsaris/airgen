# airgen

Reactive TypeScript type generator for [Airtable Custom Extensions](https://airtable.com/developers/extensions).

A `<SchemaObserver />` component inside your extension watches the base schema via the Blocks SDK and streams generated types to a local daemon that writes `airtable-schema.ts` to disk.

This library does code generation on top of the [official Airtable Blocks SDK](https://github.com/Airtable/blocks), so no API tokens and no manual regeneration are needed.

![diagram](https://raw.githubusercontent.com/pbotsaris/airgen/main/docs/dia.jpeg)

Because the schema comes from the live `Base` model, generation reacts to *every* schema mutation — renaming a field, changing a field type, adding a select choice — within ~1 second, while `block run` hot-reloads your extension with the fresh types.

## Requirements

airgen is **not** a standalone Airtable client — it only works inside a custom extension built with the Airtable Blocks SDK, and it's meant to be used alongside it while you build custom interfaces on top of your base.

- [`@airtable/blocks`](https://github.com/Airtable/blocks) `>= 1.10.0`, or an experimental `interface-alpha` build — required peer dependency. airgen reads the schema through the SDK's live `Base` model and its hooks are thin wrappers over SDK records.
- `react >= 16.14` — required peer dependency (the observer and the generated hooks are React).
- Node `>= 18` for the CLI/daemon.
- An extension scaffolded with the [Airtable CLI](https://airtable.com/developers/extensions) (`block init`), run locally with `block run`.

Everything airgen emits is typed against **`record.getCellValue(field)`** in the Blocks SDK, so the generated types only make sense in an SDK context. There is no REST API path and no Airtable personal access token anywhere in this package.

## Setup

The SDK and React come from the extension scaffold, so you never install them by hand — scaffold with the Airtable CLI first, then add airgen to that project. For an interface extension, the hello-world template is the quickest start:

```sh
npm install -g @airtable/blocks-cli
block init NONE/<your-block-id> --template=https://github.com/Airtable/interface-extensions-hello-world <your-interface-project-name>
```

`block init` takes a `<baseId>/<blockId>` identifier. Interface extensions aren't scoped to a single base, so there's no base ID to give — the literal `NONE` is the CLI's placeholder for that slot (it accepts a base ID only if it starts with `app`, or exactly `NONE`). Get `<your-block-id>` (a `blk…` ID) from Builder Hub when you create the extension.

Then, inside that project:

```sh
npm install --save-dev airgen
```

**1. Start dev through airgen (it runs `block run` for you):**

```sh
npx airgen                        # starts the schema daemon, then `block run`
npx airgen -p 3005 -o src/airtable-schema.ts
npx airgen -- --port 9001         # args after -- are passed to `block run`
```

The generated file lands at `./frontend/airtable-schema.ts` by default. To
change that (or the daemon port) without CLI flags, drop an
`airgen-config.json` next to where you run airgen:

```json
{
  "out": "./frontend/src/airtable-schema.ts",
  "port": 3005
}
```

CLI flags and the `PORT` env var take precedence over the config file.

The daemon lives inside the same process as `block run` and exits the moment
it exits, so stopping dev (ctrl-C) never leaves anything running. If you'd
rather manage `block run` yourself, `npx airgen --daemon-only` starts just
the daemon.

**2. Render the observer in your extension (dev only):**

Import from the entry point that matches your SDK flavor — the three are identical except for which of the SDK's ui modules they bind:

| Your extension | SDK ui module | Import airgen from |
|---|---|---|
| Interface extension (`@airtable/blocks@interface-alpha`) | `@airtable/blocks/interface/ui` | `airgen/interface` |
| Custom extension, stable SDK (`@airtable/blocks@1.x`) | `@airtable/blocks/ui` | `airgen` |
| Custom extension, experimental SDK | `@airtable/blocks/base/ui` | `airgen/base` |

```tsx
import {SchemaObserver} from 'airgen/interface'; // or 'airgen' on the stable SDK
import {airgenMeta} from './airtable-schema';    // optional: enables drift display

function App() {
  return (
    <>
      <SchemaObserver meta={airgenMeta} />  {/* remove or enabled={false} before release */}
      <MyExtension />
    </>
  );
}
```

The panel shows daemon connection status, table count, last sync time, and a "Copy schema" clipboard fallback for when the daemon isn't running. Two more indicators light up when available:

- **Typecheck status** (`✓ types ok` / `✗ 3 type errors`): after every schema write the daemon typechecks your project and the panel shows the result — so a field rename that breaks `record.fields.contactEmail` in your code is visible immediately, even though `block run` itself never typechecks. Expand the entry to see the first few errors with file and line.
- **Schema drift** (needs the `meta` prop): live schema vs the `airgenMeta` baked into your generated file, compared by ID — deleted tables/fields and type changes are breaking, removed select choices are warnings, renames are informational.

**3. Import the hooks straight from the generated file:**

```tsx
// anywhere in your extension (the default output lands in frontend/, next to your extension code)
import {useRecords} from './airtable-schema';

const projects = useRecords('Projects'); // table key is autocompleted & validated

projects[0]?.fields.status?.name;   // "Todo" | "In Progress" | "Done"
projects[0]?.fields.owner?.email;   // string | undefined
projects[0]?.fields.tasks?.[0].id;  // linked record id
projects[0]?.raw;                   // native SDK Record, escape hatch
```

The generated file binds the hooks itself (`export const {useRecords, useTable, useSchemaDrift} = createTypedHooks<TableRecordMap>(airgenMeta)`), so there's no wiring step — and it works from plain JS too: the generic lives inside the generated file, so `useRecords('Projects')` in a `.js` file still gets full autocomplete and field types from the editor's TypeScript service.

Commit `airtable-schema.ts` — it's the source of truth when no dev session is running (CI, teammates without the base open).

## What gets generated

- One `export interface <Table>Record` per table, all fields optional (empty cells are `null` in Airtable). Field keys are the Airtable names transliterated (Latin accents stripped: `soluções` → `solucoes`) and camelCased (`Contact Email` → `contactEmail`), so they're always plain property accesses; the raw Airtable name is kept in `airgenMeta` and the field's JSDoc. Names with nothing left after sanitization (e.g. emoji-only) fall back to the quoted raw name.
- Value types mirror **what `record.getCellValue(field)` returns in the Blocks SDK** — not the flatter REST API shapes:
  - selects → literal unions of `{ id: "sel…"; name: "…"; color?: string }`, with a named alias per field (e.g. `ProjectsStatusChoice`)
  - record links → `Array<{ id, name }>`, collaborators → `{ id, email?, name?, profilePicUrl? }`, attachments with thumbnails
  - formulas/rollups/lookups resolve to their computed result type
- `airgenMeta` — a `const` map of every table/field/choice **ID**.
- `TableRecordMap` + `TableKey` for hook inference.
- `useRecords` / `useTable` / `useSchemaDrift` — hooks already bound to the schema, imported directly from the generated file.

### Rename survival

TypeScript types are erased at compile time, so no tool can "update types at runtime" — what airgen does instead:

- `useRecords` resolves tables and fields **by ID** from `airgenMeta`, so renaming a table, field, or select choice in Airtable never breaks the running extension.
- The observer notices the same schema event and regenerates the file, so the *display names* in your types refresh automatically while you develop.
- Deleted fields are skipped gracefully; a deleted table yields `[]`.

### Efficiency

Three gates keep this cheap:

1. `useWatchable(base, ['schema'])` — the observer re-renders **only** on schema mutations, never on record/cell data changes. Keep it a leaf component.
2. A canonical schema signature (FNV-1a) is compared before doing anything — no-op events skip generation entirely.
3. Generation runs inside a 500 ms debounce, so a burst of edits costs one generation + one POST. The daemon also skips disk writes when content is unchanged.

## Typechecking

`block run` transpiles with Babel and never typechecks — a schema change that breaks your code would otherwise fail silently at runtime. So after every schema write (and once at startup) the daemon typechecks your whole project using **your project's own `typescript`** (nothing is bundled; if it isn't installed, the feature quietly reports "unavailable"). It finds the nearest `tsconfig.json` at or above the output file and runs `tsc --noEmit` in a child process, so the daemon never blocks.

Results are served at `GET /diagnostics`:

```json
{
  "status": "ok | errors | checking | unavailable",
  "errors": [{"file": "frontend/index.tsx", "line": 12, "col": 5, "code": "TS2322", "message": "…"}],
  "total": 1,
  "checkedAt": "2026-08-02T18:03:11.412Z"
}
```

The observer polls this after each sync and shows the result in the panel. Paths are project-relative (never absolute).

## Fixing your code when the schema changes

Renaming a field in Airtable regenerates your types instantly — but every `record.fields.contactEmail` in your code is now stale. Start airgen with `--fix` and it offers to rewrite them:

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
| Field/table **deleted** | Listed with every usage as `file:line` — no automatic fix, the data is gone |
| Field **type changed** | Same: the value's shape changed, so only you can decide what the code should do |

String literals are rewritten only when the type checker confirms what they are — an unrelated `const label = 'Todo'` is never touched. When it can't confirm, it skips and leaves the error for the typecheck panel: under-fixing is the intended failure mode.

Applied edits are printed to the terminal and the project is re-typechecked immediately, so the panel confirms the fix landed. **Undo is git** — these are ordinary dev-loop edits, same as an editor refactor.

A note on scope: this is the one feature that writes outside the generated file, so it exists only under `--fix`. Edits are confined to your project directory and to source extensions, a pending fix is single-use, and if you edit a file after the analysis ran the apply is refused rather than applied at stale offsets.

## Daemon security

Any webpage you visit can fire blind cross-origin POSTs at localhost, so the daemon is deliberately locked down:

- binds `127.0.0.1` only
- the output path is fixed at startup (`--out` or `airgen-config.json`); client-supplied paths in the payload are **ignored**
- payloads must be bounded (< 2 MB) strings starting with the airgen header, or they're rejected without writing
- `GET /diagnostics` and `GET /fixes` are pure state reads (they never trigger work) and report cwd-relative paths only
- `POST /apply-fix` exists only under `--fix`, takes an id and nothing else, and applies only edits the daemon computed itself — paths and edits are never accepted from the request

## Production

Remove `<SchemaObserver />` (or pass `enabled={false}`) before releasing. If it ships anyway, a released extension runs from a non-localhost origin, so browsers block the localhost request and the panel just shows "Disconnected" — nothing breaks and nothing is sent anywhere.

### Detecting schema drift in a released extension

Renames never break a running extension (everything resolves by ID), but a **deleted** table or field silently yields `[]`/`undefined`, and a **type change** makes the baked-in types lie. `useSchemaDrift` — exported by the generated file like the other hooks — detects exactly that, live, with no daemon involved:

```tsx
import {useRecords, useSchemaDrift} from './airtable-schema';

function App() {
  const drift = useSchemaDrift(); // re-runs only on schema mutations

  return (
    <>
      {drift.counts.breaking > 0 && (
        <Banner text={`This extension is out of date: ${drift.findings[0].message}`} />
      )}
      <MyExtension />
    </>
  );
}
```

The report classifies findings as `breaking` (deleted tables/fields, type changes), `warning` (removed select choices), or `info` (renames — harmless, but your generated file is stale). Wire it to a banner, your error reporting, or just ignore it. The underlying pure function is also exported as `checkSchemaDrift(base, airgenMeta)`.

## API

All of these are exported identically from `airgen`, `airgen/interface`, and `airgen/base` — the entries differ only in which SDK ui module supplies the hooks and which specifier the generated file imports.

| Export | Description |
|---|---|
| `SchemaObserver` | Dev panel component. Props: `daemonUrl` (default `http://localhost:3001`), `debounceMs` (500), `enabled` (true), `meta` (pass `airgenMeta` to surface schema drift). |
| `useRecords` / `useTable` / `useSchemaDrift` (from the **generated file**) | The hooks you actually use — pre-bound to your schema by the generated `airtable-schema.ts`. |
| `createTypedHooks<M>(airgenMeta)` | Runtime the generated file calls to bind the hooks; only needed for custom setups. |
| `checkSchemaDrift(base, airgenMeta)` | Pure drift check behind `useSchemaDrift` — returns a `DriftReport` (`{ok, findings, counts}`). |
| `generateTypeScriptFromBase(base, {hooksModule?})` | The pure generator, if you want to build your own sync flow. `hooksModule` overrides the import specifier baked into the generated file (default `'airgen'`). |
| `computeSchemaSignature(base)` | Canonical schema hash used for change detection. |
| `airgen` (bin) | `npx airgen [--port <n>] [--out <path>] [--daemon-only] [--fix] [-- <block run args>]` — wraps `block run`, daemon exits with it. Output defaults to `./frontend/airtable-schema.ts`; an optional `airgen-config.json` (`{"out", "port", "fix"}`) in the cwd overrides defaults, CLI flags override both. Health check at `GET /health`, typecheck results at `GET /diagnostics`, pending code fixes at `GET /fixes` + `POST /apply-fix` (only with `--fix`). |
