# airgen — Runtime expansion plan

Status: draft, 2026-10-17. Supersedes the standalone `airkit` plan (archived at `docs/archive/airkit-plan-2026-10-17.md`).

## 1. Decision and scope

airgen stays the single package for building typed Airtable extensions. Instead of starting a second library (`airkit`) that fetches schema through the Web API, airgen grows from "type generator" into "type generator + typed runtime": field conversion, mutations, queries, validation, and the hooks that bind them, all driven by the `airgenMeta` the generator already emits.

Why this and not a PAT-driven generator:

- **The live `Base` model is the only correct schema source for an interface extension.** The extension sees only the tables and fields the interface builder allowed. The Metadata API returns the whole base, so PAT-driven generation would emit types for fields the extension can never read, and a CI `check` could not know the allow-list. airgen's observer reads exactly what the extension can access.
- **The generator, meta, signature, drift, and codemod machinery already exist and are tested** (94 tests). Everything the runtime needs is in `airgenMeta`: table IDs, field IDs, types, choices, `options.result`.
- **The adapter pattern already solves the SDK-flavor problem.** `sdk.ts` keeps SDK imports out of core modules; the runtime extends the same adapter instead of inventing a new one.

What this plan drops from the airkit plan: PAT resolution, Metadata API client, `init`/`generate` CLI, JS+JSDoc source, Vite bundling. What it keeps nearly verbatim: the read/write type requirements, the runtime library requirements (resolver, field utilities, mutations, queries), and the React hook requirements.

Source material: `reference/` (see `reference/README.md` for the file-by-file port map).

## 2. Current state of airgen (verified 2026-10-17)

| Item | Value |
|---|---|
| Version | `0.3.0` in repo, `0.2.5` published (`latest`) |
| Workspaces | root `airgen` + `packages/ui` (`@airgen/ui@0.1.0-dev.1`) |
| Build | `tsc` over `src/client` → `dist/`; `src/daemon` ships as uncompiled ESM |
| Entry points | `airgen` (stable `@airtable/blocks/ui`), `airgen/interface`, `airgen/base`, `airgen/generator`, `airgen/daemon` |
| Tests | root: `node --test` (94 tests, require a prior build); `packages/ui`: vitest + jsdom + testing-library |
| Lint/format | none at root |
| Peers | `@airtable/blocks >=1.10.0 \|\| >=0.0.0-0`, `react >=16.14` |
| devDeps | `@airtable/blocks ^1.19.0` (stable, for typecheck), `@types/react ^17` (mismatched with `react ^19.2.8`), `typescript ^5.5` |
| Generated per table | `<Table>Record` read interface, `*Choice` unions, `airgenMeta` (v1), `TableRecordMap`, `TableKey`, pre-bound `useRecords/useTable/useSchemaDrift` |
| Field types mapped | 31 of the SDK's 33 `FieldType` members; `externalSyncSource` and `aiText` fall to `unknown` |
| Runtime hooks | `useTable(key)`, `useRecords(key)` → `{id, fields, raw}[]`, `useSchemaDrift()` |
| Writes | none |

Interface SDK facts that constrain the work:

- The interface SDK ships only on the `interface-alpha` dist-tags (`0.0.0-experimental-8575f0e0d-20260428` is what `afsp_finance` and `afsp_profit_loss` pin). React 19 peer. `latest` (1.19.0) has no `./interface/*` export.
- `@airtable/blocks/interface/models` exposes `Table` (`create/update/deleteRecord(s)Async`, `checkPermissionsFor*`, `hasPermissionTo*`, `getFieldById/ByName(IfExists)`), `Record` (`getCellValue`, `getCellValueAsString`), `Field` (`id, name, type, options, config, description, isComputed, isPrimaryField`). `interface/ui` exposes `useBase, useRecords, useCustomProperties, useWatchable, useSession, useGlobalConfig, useSynced, useColorScheme, useRunInfo, useSearchParams, expandRecord, initializeBlock, CellRenderer`.
- `./unstable_testing_utils` maps to the base SDK, not the interface SDK. Tests keep using structural fakes.
- The SDK's `field_core.d.ts` documents a **cell write format** per type, with `{interface-only}` variants. These docs are the source of truth for write types (§4).

## 3. Target architecture

### 3.1 Package layout

Keep one runtime package. `@airgen/ui` stays separate because it is UI. Revisit a `@airgen/core` split only if daemon/codemod dependencies ever bloat the install (they are currently unbundled Node files and cost nothing in the browser bundle).

```
airgen/
├── src/client/
│   ├── generator.ts            # + write types, meta v2
│   ├── schema-signature.ts     # + new option reads (three-way coupling, see CLAUDE.md)
│   ├── schema-drift.ts         # + isComputed / primaryFieldId awareness
│   ├── sdk.ts                  # adapter grows: table writes, permissions, field metadata
│   ├── useTypedRecords.ts      # createTypedHooks grows: useMutations, useFields, useQuery, config
│   ├── runtime/                # NEW, SDK-free, structural types only
│   │   ├── fields.ts           # FieldInspector: metadata, read/write conversion
│   │   ├── normalize.ts        # read helpers (select, collaborator, linked, lookup, date, number)
│   │   ├── mutations.ts        # MutableTable over SdkTable + meta
│   │   ├── queries.ts          # filter / group / search over Record<M,K>[]
│   │   ├── clone.ts            # writable-value cloning
│   │   ├── validation.ts       # ValidationResult (warnings vs blocking errors)
│   │   ├── resolver.ts         # runtime table override → compatibility check against meta
│   │   └── customProperties.ts # interface-only custom-property definitions + reads
│   ├── index.ts / interface.ts / base.ts   # unchanged roles; bind the larger adapter
│   └── SchemaObserver.tsx
├── src/daemon/                 # unchanged
├── reference/                  # TEMPORARY: airkit's src/reference + README (excluded from everything)
├── test/                       # existing + new runtime tests
└── docs/PLAN.md                # this file
```

Invariants carried over from `CLAUDE.md` and still binding: SDK imports only in the three entry points; everything resolves by ID; missing fields skip, missing tables yield empty, never throw; the three-way coupling between `resolveFieldType`, `relevantOptions`, and `buildFieldTypeMeta`.

### 3.2 Adapter growth (`sdk.ts`)

```ts
export interface SdkField {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly options: {[key: string]: unknown} | null;
  readonly isComputed: boolean;
}
export interface SdkRecord {
  readonly id: string;
  readonly name: string;
  getCellValue(field: any): unknown;
  getCellValueAsString(field: any): string;
}
export interface PermissionCheck { hasPermission: boolean; reasonDisplayString?: string }
export interface SdkTable {
  readonly id: string;
  readonly name: string;
  readonly primaryField: SdkField;
  readonly fields: ReadonlyArray<SdkField>;
  getFieldByIdIfExists(fieldId: string): SdkField | null;
  createRecordsAsync(records: ReadonlyArray<{fields: object}>): Promise<ReadonlyArray<string>>;
  updateRecordsAsync(records: ReadonlyArray<{id: string; fields: object}>): Promise<void>;
  deleteRecordsAsync(ids: ReadonlyArray<string>): Promise<void>;
  checkPermissionsForCreateRecords(records?: unknown): PermissionCheck;
  checkPermissionsForUpdateRecords(records?: unknown): PermissionCheck;
  checkPermissionsForDeleteRecords(ids?: unknown): PermissionCheck;
}
export interface BlocksSdkAdapter {
  useBase(): BaseLike & SdkBase;
  useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  useRecords(table: SdkTable): ReadonlyArray<SdkRecord> | null;
  /** Interface SDK only; undefined on the stable/base flavors. */
  useCustomProperties?(definitions: unknown): unknown;
}
```

Method syntax throughout (bivariant) so the real SDK classes remain assignable, as `sdk.ts` already notes. Entry points that lack a capability leave it `undefined` and the runtime reports "unsupported on this SDK flavor" instead of throwing.

### 3.3 Generated file additions (meta v2)

- `<Table>Write` interface per table: only writable fields, each typed with the **write** shape (§4). Computed fields are omitted, not `never`, so `Partial<<Table>Write>` is the natural update payload.
- `TableWriteMap` next to `TableRecordMap`.
- `airgenMeta.version = 2`; per table `primaryFieldId`; per field `isComputed: boolean` (from SDK `Field.isComputed`, which already accounts for formula/rollup/lookup/count/autoNumber/created*/lastModified*/button/aiText/externalSyncSource).
- Pre-bound exports grow: `export const {useRecords, useTable, useSchemaDrift, useMutations, useFields, useQuery} = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta)`.
- `AirgenMeta` runtime types keep every new key optional so files generated by 0.3.x still typecheck (same policy as `version`, `name`, `result`).
- Signature: `isComputed` and `primaryFieldId` are **not** signature inputs (they cannot change without a type change that already is). Drift: a field that became computed is a breaking change for writes; report it.

### 3.4 Hooks API (bound inside the generated file)

```ts
useRecords(tableKey)                 // existing
useTable(tableKey)                   // existing → SdkTable | null
useSchemaDrift()                     // existing
useFields(tableKey)                  // {[fieldKey]: FieldInspector | null}
useMutations(tableKey)               // MutableTable<Write[K]>: create, createMany, update, updateFields,
                                     //   updateMany, remove, removeMany, clone, can.create/update/delete
useQuery(tableKey, spec, deps?)      // memoized filter/group/search over useRecords(tableKey)
```

Non-hook factories are exported too (`createMutations(table, tableMeta)`, `inspectField(field, fieldMeta)`, `query(records, spec)`) so the runtime is usable outside React and in tests.

Custom properties (interface only): `createTypedHooks(meta, {customProperties: {deals: 'Deals table', …}})` registers one enum property per listed table and resolves overrides through `resolver.ts`, which validates the chosen table against the generated field types before `useMutations` will write to it. Incompatible types block writes (a `ValidationResult` error), rendering continues.

## 4. Read and write types per field type

Read types are what the generator emits today (they mirror `record.getCellValue`). Write types come from the SDK's documented cell write formats. `—` means the field is computed: no write type, omitted from `<Table>Write`, `isComputed: true` in meta.

| FieldType | Read (existing) | Write |
|---|---|---|
| `singleLineText`, `multilineText`, `richText`, `email`, `url`, `phoneNumber` | `string` | `string \| null` |
| `number`, `percent`, `currency`, `rating`, `duration` | `number` | `number \| null` |
| `checkbox` | `boolean` | `boolean \| null` |
| `date`, `dateTime` | `string` | `string \| Date \| null` |
| `singleSelect` | choice union `{id; name; color?}` | `{id: ChoiceId} \| {name: ChoiceName} \| null` (literal unions from the same choices) |
| `multipleSelects` | `Array<choice>` | `Array<{id} \| {name}> \| null` |
| `singleCollaborator` | `Collaborator` | `{id: string} \| null` |
| `multipleCollaborators` | `Collaborator[]` | `Array<{id: string}> \| null` |
| `multipleRecordLinks` | `LinkedRecord[]` | base SDK: `Array<{id; name?}>`; **interface SDK: `Array<{id; name?} \| {name: string}>`** (creates/links by name). Emit the interface variant only from `airgen/interface`. |
| `multipleAttachments` | `Attachment[]` | `Array<{url: string; filename?: string} \| Attachment> \| null` (new by URL, existing by read shape) |
| `barcode` | `{text; type?}` | — (the SDK documents **no** cell write format for barcode in both the stable and `interface-alpha` builds; `isComputed` is false, so the meta says writable but `<Table>Write` omits it) |
| `button` | `{label; url}` | — |
| `formula`, `rollup`, `count`, `multipleLookupValues`, `autoNumber`, `createdTime`, `lastModifiedTime`, `createdBy`, `lastModifiedBy` | existing (via `options.result` where applicable) | — |
| `externalSyncSource` | currently `unknown` → add `{id; name; color?}` | — |
| `aiText` | currently `unknown` → add `{state; value; isStale; errorType?}` | — |

Rules:

- A write type always admits `null` (clearing the cell) except where the SDK forbids it; the reference `convertTo` already treats `null`/`undefined` as "clear".
- `FieldInspector.convertTo(readValue)` maps read → write shapes (select `{id,name,color}` → `{id}`, linked `{id,name}` → `{id}`, attachment keeps the read shape) and is what `clone` and `updateMany` use. Keep it total: unknown types pass through unchanged with a validation warning.
- Verify every row against `field_core.d.ts` in the pinned `interface-alpha` build before emitting; add each write shape to `test/fixtures/mock-base.js` and to the `tsc --strict` compile test.

## 5. Tooling changes

Test tooling does not change: root stays on `node --test` + `node:assert/strict` (build first, as today), `packages/ui` stays on vitest. New runtime and hook tests follow the existing root pattern.

| Change | Why |
|---|---|
| `@types/react` → `^19` | Currently `^17` next to `react ^19`. `packages/ui` already carries `types-react-17` aliases for its React 17 check; the root does not need them. |
| devDependency `@airtable/blocks` | Keep `^1.19.0` for the stable-flavor typecheck; add nothing for alpha (ambient `blocks-experimental.d.ts` stays). Extend the ambient declarations with the write methods and `useCustomProperties`. |
| ESLint 10 flat + Prettier 3 at root | None exist. `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (for `src/client`), `eslint-config-prettier`; Prettier with 2-space, single quotes, matching existing code. Ignore `dist`, `reference`, `packages/*/dist`. |
| Scripts | `test` and `test:all` unchanged; add `lint`, `format`, `typecheck` (`tsc --noEmit`), `check` (typecheck + lint + test). |
| No Vite | `tsc` already emits ESM + declarations and the package is consumed by the Blocks CLI bundler. Vite would add a second build path for no gain. |
| TypeScript | stay on `^5.5`; TS 7 is optional and orthogonal. |

## 6. Phases

### Phase 0 — Bring-in and tooling

- [x] Copy `reference/` and `docs/` from the airkit staging folder into the airgen repo. Add `reference/` to `.gitignore`-style exclusions in `tsconfig`, ESLint, and `files` (it is already outside `src/client`). *Landed as `v0.3.0/docs` and `v0.3.0/reference`; `v0.3.0/` is ignored by ESLint and Prettier, outside `tsconfig.include` and `files`.*
- [x] `@types/react ^19`; ESLint + Prettier configs; `npm run check` green on the current code with the existing 94 tests untouched. *`check` also runs `format:check`; the tree was formatted once (SchemaObserver.tsx and bin/airgen.js were the only files on a different style). Six pre-existing lint findings fixed (dead `previousSource`, a zero-width char in a doc comment, `process.exit` fallthrough, three react-hooks rules in the observer's poll effect, disabled inline with reasons).*
- [x] Extend `blocks-experimental.d.ts` with `createRecordsAsync`, `updateRecordsAsync`, `deleteRecordsAsync`, `checkPermissionsFor*`, `Field.isComputed`, `useCustomProperties`. *Only `useCustomProperties` needed a declaration; the model surface rides on `useBase(): any` and is narrowed by `sdk.ts`, which the file now says.*
- [x] Update `CLAUDE.md`: new folders, new scripts, `reference/` policy.

**Milestone:** unchanged behavior, new toolchain, reference code in place. ✅ 2026-10-17

### Phase 1 — Generator: write types and meta v2

- [x] `FieldLike` gains optional `isComputed`; `TableLike` gains optional `primaryFieldId`. `SchemaObserver` passes them from the live SDK; `mock-base.js` sets them. *`TableLike` got `primaryField?: {id}` instead, so the live SDK `Base` still passes through the observer untouched (the SDK has no `primaryFieldId`); the meta key is `primaryFieldId`. The fixture derives both the way the SDK reports them.*
- [x] `resolveWriteType(type, options, selectAlias)` beside `resolveFieldType`; `<Table>Write` emission; `TableWriteMap`; interface-only linked-record variant keyed off `hooksModule`. *Keyed off a new `GeneratorOptions.sdkFlavor` ('stable' | 'interface' | 'base') that defaults from `hooksModule`, so a monorepo alias can still pick the interface shapes. The generated file already binds `createTypedHooks<TableRecordMap, TableWriteMap>` (second generic accepted, unused until Phase 3). Barcode omitted — see §4.*
- [x] Map `externalSyncSource` and `aiText` read types.
- [x] Meta v2 (`version: 2`, `primaryFieldId`, `isComputed`); keep runtime `AirgenMeta` keys optional. *`META_VERSION` exported from the generator and the entry points.*
- [x] Three-way coupling: nothing new is read from `options` for write types, so `relevantOptions` is unchanged. Add a test that pins this. *Stripping every option but `choices`/`result` leaves the signature and the Write interfaces byte-identical.*
- [x] Drift: flag writable→computed as breaking. *`field-became-computed`, only when the meta recorded `isComputed: false` and the live field says `true`. The daemon's codemod diff was left alone: a type change always precedes it and is already reported.*
- [x] Snapshot + `tsc --strict` compile tests for the new output; type tests with `// @ts-expect-error` on wrong write values. *`test/fixtures/snapshots/` (refresh with `UPDATE_SNAPSHOTS=1`) and `test/fixtures/consumers/` for both flavors.*
- [x] CHANGELOG entry. *Under `[Unreleased]`.*

**Milestone:** generated file carries correct write types; `afsp_finance` regenerates with zero consumer changes. ✅ code side 2026-10-17 — the `afsp_finance` regeneration is still to be run under `block run`.

### Phase 2 — Runtime core (SDK-free)

- [x] `runtime/validation.ts` from `ValidationResult.js`. *Issues are `{kind, level, message, fieldKey?}`; `valid()` = no errors. The reference's `errorType`/`items()`/string `toJSON` were resolver-specific and dropped; Phase 3's resolver adds its own kinds.*
- [x] `runtime/fields.ts` (`FieldInspector`, `convertTo`) from `fields.js` + `airtableTypes.js`; one shared per-type table with the generator. *The table is `src/client/field-types.ts` (`writeKind(type)`), outside `runtime/` because the generator's `resolveWriteType` now switches on it too; output is byte-identical. `convertTo` follows §4 (read → write shape) and is idempotent; the reference's percent ×100 convention, `selectComponent` target and `colorUtils` colors were app/UI concerns and are not ported. `airtableTypes.js` typedefs are already the generated shared types.*
- [x] `runtime/normalize.ts` from `normalize.js`, trimmed to what adds value over `useRecords`. *`lookupValues`, `firstLookupValue`, `cellIds`, `cellNames`, `firstLinkedRecord`; total, never throw. The shape-validating getters are redundant with typed reads.*
- [x] `runtime/mutations.ts` from `mutations.js`: generic over the write map, resolves fields by meta ID, converts through `FieldInspector`, checks permissions, batches by 50, ~~returns `[ok, error]`~~ returns `{ok, ids, issues}` / `{ok: false, error, ids, failedBatch, issues}` (§8.3), reports partial batch failures explicitly. *Validation and every batch's permission check run before the first write, so only an SDK rejection can leave a partial write; it stops at that batch and reports the committed ids. `undefined` values are omitted, `null` clears. Methods are closures, so destructuring works. `SdkTable`/`SdkField`/`SdkRecord` in `sdk.ts` grew to §3.2 now (the stable SDK still satisfies them); the adapter and entry binding stay in Phase 3.*
- [x] `runtime/clone.ts` from `cloneRecord.js`, using `isComputed`. *Also skips hidden, retyped, unknown-type and attachment fields (attachments as in the reference); unwritable override keys are dropped.*
- [x] `runtime/queries.ts` from `queries.js` + `airtableUtils.js`. Decide on `fuse.js` (dependency vs optional injection). *Injection (§8.1). Spec-based over `useRecords` rows instead of a builder over SDK fields: `query(records, {where, match, search})` and `groupRecords(records, {fields, by})`. Selects/links/collaborators match by id, name or email.*
- [x] `node --test` unit tests (`test/runtime-*.test.js`, importing from `dist/` like the rest) with structural fakes (`SdkTable`, `SdkRecord`) for every module; no SDK import anywhere under `runtime/`; an `entries`-style test pins that. *Fakes in `test/fixtures/fake-sdk.js`; the entries test scans every `runtime/` module for non-relative imports (so fuse.js can't creep in either).*

**Milestone:** `createMutations(fakeTable, tableMeta).update(...)` works end to end in Node. ✅ 2026-10-17 — `npm run check` green, 146 tests.

### Phase 3 — Hooks and runtime overrides

- [ ] Grow `sdk.ts` per §3.2; bind in `index.ts`, `interface.ts`, `base.ts`.
- [ ] `createTypedHooks<M, W>`: `useFields`, `useMutations`, `useQuery`; non-hook factories exported.
- [ ] `runtime/customProperties.ts` + `runtime/resolver.ts` from the `config/` files, interface-flavor only; `createTypedHooks(meta, {customProperties})`.
- [ ] Hook tests under `node --test` with a fake `BlocksSdkAdapter` whose `useBase`/`useRecords` are plain functions, so `createTypedHooks(meta)` returns callable functions without React or jsdom. Cover the "table hidden from this extension" path and that `useMutations` refuses writes on a blocking `ValidationResult`. Memo stability is checked once in `afsp_finance` under `block run` (Phase 4), not in unit tests.
- [ ] Generated-file compile test extended to the new pre-bound exports.

**Milestone:** an extension writes records through `useMutations('Lancamentos')` with autocomplete on field keys and write values.

### Phase 4 — Consumer migration, docs, release

- [ ] Migrate one write path in `afsp_finance` to `useMutations`; run under `block run`; confirm bundle size and no SDK-flavor import leaks.
- [ ] README: runtime section (fields, mutations, queries, custom properties), migration notes for meta v2.
- [ ] Remove `reference/`.
- [ ] Release `airgen@0.4.0`.

### Phase 5 — Later

- Optional PAT-based `airgen check` for CI, scoped to the tables and fields already in the generated file (never the whole base). Reuses the archived airkit notes on token resolution; the Blocks CLI token lacks `schema.bases:read`, so a dedicated PAT is required.
- `@airgen/core` split if warranted.
- Port the app-specific hooks into an `examples/` extension.

## 7. Testing strategy

| Layer | Approach |
|---|---|
| Generator | `mock-base.js` extended with `isComputed`, `primaryFieldId`, and every write shape; snapshot of the generated file; `tsc --strict` compile test (already the most valuable test). |
| `runtime/` | Pure functions over structural fakes; no SDK; `node --test` against `dist/`, same as the existing suite. |
| Hooks | Fake `BlocksSdkAdapter` with plain-function hooks under `node --test`; no React, no jsdom. Assert null/missing paths and write blocking. |
| Static types | `// @ts-expect-error` consumer-style files compiled by the existing `tsc --strict` compile test, e.g. `useMutations('Lancamentos').update(rec, {valor: 'not a number'})` must fail. |
| Entry points | Extend `test/entries.test.js` so `runtime/` and `useTypedRecords.ts` never import an SDK path. |
| Live | `afsp_finance` under `block run` against `appJVUOH1y8koycl1` ("AFSP: Financeiro"). |

## 8. Open decisions

1. ~~**`fuse.js` in the core package** or injected by the consumer~~ **Decided 2026-10-17: injected.** airgen keeps zero runtime dependencies; `query()` takes `search.matcher: SearchMatcher` (`(texts, query) => indices`, best first), defaulting to an accent/case-insensitive token match. `@airgen/ui` (which already depends on fuse.js) exports `fuseMatcher` with the reference's settings (`threshold: 0.4, ignoreLocation: true`), typed structurally since `@airgen/ui` doesn't depend on airgen.
2. **Overrides table support** (the reference's 2/3-column config table): keep as optional resolver input, or drop in favor of custom properties only.
3. ~~**Mutation result shape**~~ **Decided 2026-10-17: object.** `{ok: true, ids, issues} | {ok: false, error, ids, failedBatch, issues}`.
4. ~~**`useRecords` field shape**~~ **Decided 2026-10-17: unchanged.** `clone` and `convertTo` read through the SDK record and the meta-resolved field, which already tells empty from not visible. Revisit only if a Phase 3 hook needs it.
5. **Peer range for the alpha SDK:** keep `>=0.0.0-0`.
6. ~~**Lookup read type**~~ **Fixed 2026-10-17.** `resolveFieldType` emitted lookups as `Array<Result>`, but both SDK builds read them as `Array<{linkedRecordId; value: Result}>`; the generated file now declares `LookupValue<T>` and emits `Array<LookupValue<Result>>`. A breaking type change for consumers that read lookup entries as bare values (CHANGELOG).

## 9. Environment notes

- Dev base: `appJVUOH1y8koycl1` = "AFSP: Financeiro". Consumers: `~/dev/antfood/internal/afsp_finance`, `afsp_profit_loss` (both `interface-alpha`, React 19, ESLint flat, Tailwind).
- Blocks CLI 3.0.3, Node 26.10, npm 11.19 on the dev machine.
- The Blocks CLI PAT (`~/.config/.airtableblocksrc.json`) returns 403 on all `/v0/meta/*` endpoints. Irrelevant for Phases 0–4; only Phase 5's optional `check` needs a token.
