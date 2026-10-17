# Airtable Interface Kit — Development Plan

## 1. Overview

Build a JavaScript library that simplifies development of custom Airtable Interface Extensions using `@airtable/blocks/interface`.

The library will provide automatic schema discovery, JSDoc type generation, runtime configuration, reusable data utilities, mutations, queries, and React hooks.

It will build upon the existing implementation in `src/reference`, extracting the reusable functionality and adapting it to work with any user-selected Airtable base.

**Primary goal:** Developers should be able to connect an Airtable base, select the tables they need, generate type-safe definitions, and immediately start building Interface Extensions with minimal boilerplate.

### Core principles

- JavaScript-first, with JSDoc-based type safety and editor autocomplete.
- Reuse the official Airtable Interface SDK instead of replacing it.
- Keep the runtime independent of the Web API and authentication credentials.
- Prefer generic, strongly typed utilities over table-specific implementations.
- Generate schema information and types at development time.
- Support changes to Airtable schemas through regeneration and runtime validation.
- Keep dependencies and configuration minimal.

## 2. Requirements and dependencies

### Development environment

- Node.js `>= 20` (native `fetch`, stable ESM). Verified locally on 2026-10-17: Node 26.10.0, npm 11.19.1.
- `@airtable/blocks-cli` installed and accessible through the `block` command. Verified: 3.0.3.
- An initialized Airtable Interface Extension project (`block.json` + `.block/remote.json`).
- `@airtable/blocks` and React as runtime peer dependencies.

The library itself should use ES modules (`"type": "module"`), consistent with the existing source code.

### Interface SDK version (verified)

The Interface Extensions SDK is **not** on the `latest` npm tag. `@airtable/blocks@1.19.0` (latest) has no `./interface/*` export and peers on React 16/17. The interface SDK ships on the `interface-alpha` dist-tags:

| dist-tag | version | React peer |
|---|---|---|
| `interface-alpha` | `0.0.0-experimental-8575f0e0d-20260428` | `^19.0.0` |
| `interface-alpha-next` | `0.0.0-experimental-3c2a2d775-20260807` | `^19.0.0` |

Both sibling extensions (`afsp_finance`, `afsp_profit_loss`) pin `interface-alpha` and React 19. airkit must:

- Pin `@airtable/blocks@interface-alpha` as a **devDependency** (exact version in the lockfile).
- Declare `@airtable/blocks` as a peer with a range that accepts prereleases (`>=0.0.0-0`; plain `*` does not match `0.0.0-experimental-…` under npm semver). Verify with `npx semver` during setup.
- Declare `react`/`react-dom` peers as `^19.0.0`.
- Import only from `@airtable/blocks/interface/models` and `@airtable/blocks/interface/ui`. Both resolve `.d.ts` via `exports.types`, so JSDoc `import("@airtable/blocks/interface/models").Table` works with `moduleResolution: "bundler"`.
- Note: `./unstable_testing_utils` maps to the *base* SDK, not the interface SDK. Tests must use structural fakes rather than SDK mocks (see Testing strategy).

Interface SDK surface relevant to the runtime (from the pinned build): `Table` has `create/update/deleteRecord(s)Async`, `checkPermissionsFor*`, `hasPermissionTo*`, `getFieldById/ByName(IfExists)`; `Record` has `getCellValue`, `getCellValueAsString`; `Field` exposes `id, name, type, options, config, description, isComputed, isPrimaryField`; `FieldType` has 33 members. `interface/ui` exports `useBase, useRecords, useCustomProperties, useWatchable, useSession, useGlobalConfig, useSynced, useColorScheme, useRunInfo, useSearchParams, expandRecord, initializeBlock, CellRenderer`. There is no component library in the interface SDK.

### Toolchain

| Concern | Tool | Notes |
|---|---|---|
| Bundling | Vite (library mode) | Two browser entries: `core`, `react`. ESM only. Externalize `react`, `react-dom`, `@airtable/blocks/*`. The CLI is **not** bundled; it ships as plain ESM from `src/cli/` with a `bin` entry. |
| Tests | Vitest | Node environment for core/codegen/cli; `jsdom` + `@testing-library/react` for hooks; snapshot tests for generated files. |
| Types | TypeScript (`tsc`) | `checkJs` over `src/` and `tests/` for static checking. `tsc --declaration --emitDeclarationOnly --allowJs` emits the public `.d.ts` into `dist/`. No TS source files. |
| Lint | ESLint 10 flat config | `@eslint/js` recommended, `eslint-plugin-jsdoc` (typescript-flavor rules), `eslint-plugin-react-hooks` scoped to `src/react/`, `globals`, `eslint-config-prettier`. |
| Format | Prettier 3 | `tabWidth: 3` to match the reference code and minimize migration diffs. |
| CLI runtime deps | `commander`, `@clack/prompts` | Native `fetch`; no `airtable` npm client. Keep the dependency list to these two plus (optionally) `picocolors`. |

### Airtable authentication

Schema generation requires an Airtable Personal Access Token (PAT) with `schema.bases:read` permission and access to the selected base.

The existing Blocks CLI credential should be considered a possible authentication source, but not assumed to have sufficient permissions.

The CLI should resolve credentials in this order:

1. An explicit environment variable, such as `AIRTABLE_TOKEN` or `AIRTABLE_API_KEY`.
2. An existing PAT stored by the Airtable Blocks CLI.
3. An interactive prompt requesting a token.

The Blocks CLI commonly stores its configuration at:

- **macOS/Linux:** `~/.config/.airtableblocksrc.json`
- **Windows:** `%USERPROFILE%\.config\.airtableblocksrc.json`

The expected configuration may contain:

`airtableApiKey.default`

Support this format but validate it against the installed CLI version, rather than treating the internal configuration structure as a guaranteed public API.

**Verified on this machine (2026-10-17):** `~/.config/.airtableblocksrc.json` exists with a single `airtableApiKey.default` PAT. The Blocks CLI only requires `block:manage` for that token (`block set-api-key --help`), and this one returned **403** on `GET /v0/meta/whoami`, `GET /v0/meta/bases`, and `GET /v0/meta/bases/appJVUOH1y8koycl1/tables`. Expect step 2 to fail for most users. Consequences:

- Validate any candidate token with `GET /v0/meta/whoami` first. A 403 there means the token has no metadata scope; report "token lacks `schema.bases:read`" (never the token itself) and continue to the next source.
- Airtable returns the same `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND` error for a missing scope and for a base the token cannot see. After `whoami` succeeds, a 403 on the tables endpoint means base access, not scope.
- For local development, create a PAT with `schema.bases:read` scoped to the dev base and put it in `.env` as `AIRTABLE_TOKEN`. `.env` is already gitignored; add a committed `.env.example`.
- `airtable.js` (0.12.2) does not help here: it wraps record endpoints only and its `makeRequest` is scoped to `/v0/{baseId}/…`, so it cannot call `/v0/meta/*`. It also pulls in lodash and node-fetch polyfills. Use native `fetch` for the two metadata calls. Keep `airtable.js` in mind only if a Node-side record-reading path is ever added (out of scope for v1).

**Security requirements:**

- Never embed credentials in generated code or the browser bundle.
- Never print tokens in logs, error messages, or command output.
- Do not persist newly entered credentials without explicit user consent.
- Limit Web API usage to the Node.js development tooling.

## 3. CLI and project initialization

Provide a CLI executable through the npm package.

Proposed commands:

| Command | Purpose |
|---|---|
| `init` | Connect a base, select tables, and initialize configuration |
| `generate` | Fetch schema metadata and regenerate types |
| `check` | Detect differences between the generated schema and the current base |

Additional commands such as `watch` and `doctor` can be considered later.

### Initialization workflow

1. Verify that `@airtable/blocks-cli` is installed using `block --version`.
2. Verify that the current directory is an Airtable extension project: `block.json` with `frontendEntry`, plus `.block/remote.json`.
3. Read an existing `airkit.config.json` (base ID, selected tables, aliases, output paths) if present. Do **not** expect a base ID from the Blocks CLI: interface extensions are not base-scoped and `.block/remote.json` stores `"baseId": "NONE"` (verified in both sibling projects).
4. Resolve a valid PAT.
5. Resolve the Airtable base from an explicit ID, a unique name, or an interactive selection.
6. Fetch the base schema.
7. Present the available tables and let the developer select which ones to include.
8. Allow developers to configure stable JavaScript aliases for selected tables.
9. Generate schema definitions, type declarations, and configuration files.
10. Display a summary of the generated files and the next steps.

Avoid requiring users to enter information that can be discovered reliably from the existing project.

### Web API integration

Use the Airtable Metadata API:

- `GET /v0/meta/bases` to discover accessible bases.
- `GET /v0/meta/bases/{baseId}/tables` to retrieve the schema.

The schema request returns base metadata, including tables, fields, field types, field options, and views.

Only retrieve schema metadata. Reading actual records is not required for code generation.

Implement authentication checks, clear API error reporting, and retry handling where appropriate.

## 4. Schema representation and code generation

This is the central feature of the library.

### 4.0 Relationship to airgen

`airgen` (`~/dev/antfood/internal/airgen`, same author, published on npm) already generates TypeScript types for Airtable extensions, but with a different pipeline: a `<SchemaObserver />` inside the running extension reads the live SDK `Base` and streams generated TS to a local daemon. No PAT, no CLI step, reactive during `block run`. `afsp_finance` consumes it today (`frontend/airtable-schema.ts`, header `// Generated by airgen`).

airkit is **not** a replacement for that workflow. It covers what airgen cannot: generation without a running extension (CI, `check`), a runtime JS schema module, explicit **write** types, and the resolver/mutation/query/hook layer. Decisions:

- **Port, do not depend.** airgen is TS-source-emitting and TS-compiled; airkit emits `.js` + `.d.ts` from JS. Port the field-type mapping (`resolveFieldType`, choice unions, lookup `options.result` recursion, attachment/collaborator/linked-record shapes) into `src/codegen/`. It is already validated against the dev base.
- **Keep the schema model structural.** Define airkit's normalized model so that airgen's `BaseLike / TableLike / FieldLike` objects satisfy it. Metadata API JSON (`id`, `name`, `type`, `options`, `description`) and SDK `Field` objects both map onto it, which keeps the generator runnable in Node with plain fixtures and leaves the door open to an SDK-observer source later.
- **Reuse airgen's conventions** where they are already proven: generated-file header, schema signature line, choice unions keyed by `id` + `name`, diacritic-stripped camelCase aliases (`Contas Bancárias` → `contasBancarias`, `Janela de Seleção` → `janelaDeSelecao`).
- **Diverge deliberately** on: separate read vs write types; runtime `.js` schema with IDs; alias conflicts as errors; no codemod/daemon in v1.
- Revisit merging the two packages after airkit's Phase 3; until then they stay independent.

### 4.1 Schema discovery

For each selected table, extract:

- Table ID and name.
- Primary field ID.
- Field IDs, names, descriptions, and types.
- Field options and relevant configuration.
- Single-select and multiple-select choices.
- Linked-record relationships and target table IDs.
- Computed and read-only field information, where determinable.

Normalize this metadata into an internal schema representation that the generator and runtime can share.

### 4.2 Stable identifiers

Use Airtable table and field IDs as the canonical identifiers.

Generate readable aliases for developers, such as `deals`, `status`, and `totalBudget`, while preserving the original Airtable IDs and names.

This allows a renamed Airtable field to retain its identity without breaking application code.

Handle duplicate or conflicting aliases explicitly. Do not silently choose between ambiguous names.

### 4.3 Generated artifacts

Generate two complementary outputs:

**Runtime schema:** A JavaScript module containing the selected table and field definitions, IDs, metadata, and aliases.

**Type declarations:** A generated `.d.ts` module describing the schema and its value types, consumable through JSDoc imports from JavaScript.

Using `.d.ts` declarations does not require the developer to write TypeScript. It allows TypeScript's language service to provide accurate static checking for JavaScript.

Generated files should be deterministic, clearly marked as generated, and not manually edited.

### 4.4 Type generation

Generate definitions for:

- Available table keys.
- Available fields per table.
- Resolved Airtable Table and Field objects.
- Field read-value types.
- Field write-value types.
- Record value maps.
- Select-choice names and IDs as literal unions where possible.
- Linked-record values.
- Nullable and optional values.
- Computed and read-only fields.

**Important:** Read and write values are not always equivalent.

For example, a linked-record cell may be read as an array of objects containing IDs and names, but written using an array of objects containing record IDs.

The generated types must model the actual Interface SDK behavior, not simply reuse the Web API's record formats.

Use explicit, conservative types for unsupported or ambiguous field configurations rather than guessing.

### 4.5 Schema synchronization

Provide a regeneration command that:

- Fetches the current schema.
- Preserves configured table and field aliases wherever possible.
- Updates generated definitions.
- Reports additions, deletions, renames, and type changes.
- Warns about incompatible changes.

A separate `check` command should detect outdated generated files without changing them, enabling CI validation.

## 5. Runtime library

Refactor the functionality in `src/reference` into independently reusable modules.

The runtime should use the generated schema and Airtable Interface SDK objects. It should not require a PAT or call the Metadata API.

### 5.1 Schema resolver

Start from the existing `schemaRegistry.js`, `schemaResolver.js`, `configResolver.js`, and `ValidationResult.js`.

Replace the manually maintained, application-specific registry with generated definitions.

The resolver should:

- Resolve tables and fields by ID.
- Optionally support name and alias fallback.
- Verify field types.
- Detect missing or inaccessible tables and fields.
- Report schema incompatibilities.
- Expose typed table and field maps.
- Return structured validation results.

Preserve the existing validation approach, distinguishing recoverable warnings from blocking errors.

Incompatible field types must block unsafe writes, even when the interface can still render.

### 5.2 Field utilities

Adapt `fields.js`, `normalize.js`, `airtableTypes.js`, and `cloneRecord.js`.

Provide generic utilities for:

- Reading field values safely.
- Converting read values into writable shapes.
- Working with single and multiple selects.
- Resolving select choices and colors.
- Reading collaborators and linked records.
- Unwrapping lookup values.
- Handling numbers, percentages, and dates.
- Cloning writable record values.
- Inspecting field metadata.

Remove dependencies on application-specific React components. Keep UI-oriented conversions behind optional adapters.

Conversion behavior should be explicit and consistent, especially when clearing cells or handling already-normalized values.

### 5.3 Mutations

Refactor the existing `MutableTable` into a generic, type-aware mutation API.

Preserve and generalize its functionality:

- Create a record.
- Create multiple records.
- Update one field.
- Update multiple fields.
- Update multiple records with shared or individual values.
- Delete one or more records.
- Clone a record's writable values.
- Inspect permissions before attempting writes.

The type system should validate both field keys and their corresponding writable value types.

All mutation methods should use consistent value conversion rules.

Handle missing fields, read-only fields, permission failures, and partial batch failures explicitly.

Keep the existing 50-record batching approach where appropriate for the SDK.

### 5.4 Queries

Adapt `queries.js` and `airtableUtils.js` into a reusable, type-aware query layer.

Preserve the existing capabilities:

- Filtering by field.
- Equality and inequality comparisons.
- `anyOf` and `noneOf` comparisons.
- Empty-value filtering.
- Combining conditions using AND/OR.
- Fuzzy searching.
- Grouping records by one or multiple fields.

Queries operate on records already loaded through the Interface SDK.

Improve typing, normalization, null handling, and the structure of query results.

Do not build a separate Web API query client in the initial release.

## 6. React integration

Provide generic React hooks built on top of the runtime library and the official Airtable SDK.

Potential public API:

- `useAirtable()` — access resolved schema, configuration, and validation.
- `useAirtableTable(tableKey)` — access one typed table and its fields.
- `useTableMutations(tableKey)` — create a typed mutation interface.
- `useTableRecords(tableKey)` — optional convenience wrapper around SDK record hooks.
- `useFieldInspector(tableKey, fieldKey)` — optional memoized field inspection.

Actual hook signatures should be finalized after the runtime API is implemented.

### Generation versus runtime resolution

**Preferred approach: Keep hooks generic and generate their type information.**

The existing `useTableMutations.js` uses manually written overloads for each supported table. Replace these with a generic mapping based on generated table definitions.

This avoids generating one hook per table and makes the library easier to maintain.

Only consider generating specialized hooks if generic JSDoc typing cannot achieve the desired developer experience.

### Custom properties

Preserve support for Airtable Interface custom properties where useful.

Runtime table overrides should be treated separately from the generated schema. If an interface selects a different table at runtime, the library must validate its compatibility before relying on generated field types.

## 7. Project organization

Proposed library source structure:

- `src/cli/` — commands, authentication, project discovery, and Airtable API client.
- `src/codegen/` — schema normalization, type mapping, and file generation.
- `src/core/` — schema resolution, validation, field utilities, mutations, and queries.
- `src/react/` — generic React hooks.
- `src/reference/` — existing implementation, retained temporarily during migration.
- `tests/` — runtime, generator, and static type tests.
- `examples/` — example Interface Extension using the published library.

Generated schema files belong in the **consumer's Airtable project**, not inside the library package itself.

Expose separate package entry points for the runtime and React integration. Keep Node.js-only CLI dependencies out of the browser bundle.

Use ES modules and provide JSDoc-compatible declarations for the public API.

### Repository tooling files

```
airkit/
├── bin/airkit.js              # #!/usr/bin/env node → import("../src/cli/main.js")
├── src/{cli,codegen,core,react,reference}/
├── tests/
│   ├── fixtures/              # Metadata API JSON (captured from the dev base), synthetic schemas
│   ├── codegen/               # snapshot tests for generated .js/.d.ts
│   ├── core/  react/  cli/
│   └── types/                 # .js files checked by tsc with @ts-expect-error assertions
├── examples/
├── vite.config.js             # lib mode + vitest `test` block
├── tsconfig.json              # allowJs, checkJs, strict, noEmit; include src (minus reference) + tests
├── tsconfig.build.json        # declaration-only emit to dist/
├── eslint.config.js
├── prettier.config.js
├── .env.example               # AIRTABLE_TOKEN=
└── .github/workflows/ci.yml   # npm ci && npm run check
```

`src/reference/` stays excluded from `tsconfig`, ESLint, Vite, and `files` until it is deleted at the end of Phase 4. It imports modules that do not exist in this repo and will never typecheck as-is.

### `package.json` target shape

The current file has four problems: `main` points at a nonexistent `index.js`; `homepage`/`repository`/`bugs` point at `pbotsaris/airtype` while the package is `airkit`; `scripts.test` is the placeholder `"test"`; there are no `engines`, `exports`, `bin`, or peer dependencies. Target:

```jsonc
{
  "name": "airkit",
  "type": "module",
  "engines": { "node": ">=20" },
  "sideEffects": false,
  "bin": { "airkit": "./bin/airkit.js" },
  "exports": {
    ".":       { "types": "./dist/core/index.d.ts",  "default": "./dist/core.js" },
    "./react": { "types": "./dist/react/index.d.ts", "default": "./dist/react.js" },
    "./package.json": "./package.json"
  },
  "files": ["dist/", "bin/", "src/cli/", "src/codegen/", "README.md", "LICENSE"],
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "check": "npm run typecheck && npm run lint && npm run format:check && npm test"
  },
  "peerDependencies": {
    "@airtable/blocks": ">=0.0.0-0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": { "commander": "^15", "@clack/prompts": "^1" },
  "devDependencies": {
    "@airtable/blocks": "interface-alpha", "react": "^19", "react-dom": "^19", "@types/react": "^19",
    "vite": "^8", "vitest": "^5", "jsdom": "latest", "@testing-library/react": "latest",
    "typescript": "^7", "@types/node": "^26",
    "eslint": "^10", "@eslint/js": "^10", "eslint-plugin-jsdoc": "^65", "eslint-plugin-react-hooks": "^7",
    "eslint-config-prettier": "latest", "globals": "^17", "prettier": "^3"
  }
}
```

`src/cli/` and `src/codegen/` ship unbundled because they are Node-only; `src/core/` and `src/react/` ship only through `dist/`. Fix the repository URLs to the real remote (or drop them until one exists), and add a `LICENSE` file since `license` already says MIT.

## 8. Implementation phases

Phase order changed from the original draft: the schema model and generator come before the interactive CLI. The generator is the risky part and can be developed entirely against a captured fixture; the CLI is thin once the generator and the two `fetch` calls exist.

### Phase 0 — Project setup and tooling

- [ ] Rewrite `package.json` to the target shape in §7 (exports, bin, engines, peers, scripts). Fix repository URLs. Add `LICENSE`.
- [ ] Install devDependencies; confirm `@airtable/blocks@interface-alpha` resolves and that `>=0.0.0-0` matches it (`npx semver -r ">=0.0.0-0" 0.0.0-experimental-8575f0e0d-20260428`).
- [ ] `tsconfig.json`: `allowJs`, `checkJs`, `strict`, `noEmit`, `module: esnext`, `moduleResolution: bundler`, `target: es2022`, `jsx: react-jsx`, `lib: [es2022, dom]`, `types: [node]`; include `src/{cli,codegen,core,react}`, `tests`, `bin`; exclude `src/reference`. `tsconfig.build.json`: `declaration`, `emitDeclarationOnly`, `outDir: dist`, include `src/{core,react}` only.
- [ ] `vite.config.js`: `build.lib` with `entry: { core, react }`, `formats: ['es']`, `rollupOptions.external: [/^react/, /^@airtable\/blocks/]`, `sourcemap`; `test` block with `environment: 'node'` default and `environmentMatchGlobs` (`tests/react/**` → `jsdom`).
- [ ] `eslint.config.js` (flat): `@eslint/js` recommended, `eslint-plugin-jsdoc` `flat/recommended-typescript-flavor`, `react-hooks` for `src/react/**`, `globals.node` for cli/codegen and `globals.browser` for core/react, `eslint-config-prettier` last. Ignore `dist`, `src/reference`, `coverage`.
- [ ] `prettier.config.js`: `tabWidth: 3`, `printWidth: 100`, `singleQuote: false` (matches the reference code).
- [ ] `.env.example` with `AIRTABLE_TOKEN=`; confirm `.env` is ignored (it is).
- [ ] Create `src/{cli,codegen,core,react}/index.js` stubs and `bin/airkit.js` so `npm run check` passes end to end on an empty library.
- [ ] Capture `tests/fixtures/afsp-financeiro.tables.json` from `GET /v0/meta/bases/appJVUOH1y8koycl1/tables` with a throwaway script using the new PAT (schema only, no records). Add a small synthetic fixture covering every `FieldType` member.
- [ ] `.github/workflows/ci.yml` running `npm ci && npm run check` on Node 20 and 22.
- [ ] Update `CLAUDE.md` with the commands and the `src/reference` exclusion.

**Milestone:** `npm run check` and `npm run build` succeed; `dist/` contains `core.js`, `react.js`, and declarations; the fixture is committed.

### Phase 1 — Schema model and code generation

- [ ] Define the internal schema model (`src/codegen/schema.js` typedefs), structurally compatible with airgen's `BaseLike`.
- [ ] Normalize Metadata API JSON into the model; unit tests against both fixtures.
- [ ] Build stable JavaScript aliases (diacritic stripping, camelCase, reserved-word escaping) with explicit conflict reporting.
- [ ] Port and extend the field-type mapping: read types and write types per `FieldType`, select-choice literal unions, lookup/rollup `options.result` recursion, computed/read-only flags, conservative `unknown` for unsupported configs.
- [ ] Emit the runtime schema module (`airtable-schema.js`) and declarations (`airtable-schema.d.ts`); deterministic output, generated header, signature line.
- [ ] Snapshot tests for both artifacts; `tests/types/` consumer-style checks that the emitted `.d.ts` typechecks and rejects wrong field keys and wrong write values.
- [ ] Diff two normalized schemas: additions, deletions, renames (by ID), type changes, choice changes.

**Milestone:** From a fixture, airkit emits files that give a JavaScript editor correct autocomplete and type checking for selected tables and fields.

### Phase 2 — CLI and schema discovery

- [ ] `bin/airkit.js` + `commander` program with `init`, `generate`, `check`.
- [ ] Detect the installed Blocks CLI and an extension project (`block.json`, `.block/remote.json`).
- [ ] Token resolution in the documented order, with `whoami` validation and scope-specific error messages. Unit-test with a mocked `fetch`.
- [ ] Metadata API client: `listBases`, `getBaseSchema`, retry on 429/5xx, no token in any error string.
- [ ] Base selection by ID, unique name, or `@clack/prompts` picker; table multi-select; alias editing.
- [ ] Write `airkit.config.json`; `generate` reads it and reports the diff; `check` exits non-zero when outdated.
- [ ] Manual run against `AFSP: Financeiro` from inside `afsp_finance` (`npm link`).

**Milestone:** A developer can initialize the library against a real base and regenerate on demand.

### Phase 3 — Core runtime migration

- [ ] Migrate schema resolution and validation.
- [ ] Extract and generalize `FieldInspector`.
- [ ] Migrate normalization and conversion utilities.
- [ ] Refactor `MutableTable` to support typed field values.
- [ ] Migrate record cloning and query utilities.
- [ ] Remove application-specific dependencies.

**Milestone:** Generic runtime utilities operate correctly with generated schemas.

### Phase 4 — React hooks

- [ ] Implement generic configuration and table hooks.
- [ ] Implement typed mutation hooks.
- [ ] Integrate Airtable custom properties where useful.
- [ ] Verify React hook stability and update behavior.
- [ ] Migrate one existing application to the new API.

**Milestone:** An Interface Extension uses the library without maintaining manual table definitions or hook overloads.

### Phase 5 — Testing, documentation, and release

- [ ] Test against multiple synthetic base schemas.
- [ ] Test renamed, removed, and incompatible fields.
- [ ] Test nullable, computed, linked, and lookup values.
- [ ] Test permissions and mutation failures.
- [ ] Test generated declarations in a JavaScript project with `checkJs`.
- [ ] Verify that no token enters generated files or browser bundles.
- [ ] Add getting-started documentation and API examples.
- [ ] Confirm installation and bundling with a real Interface Extension.
- [ ] Publish an initial npm release.

**Milestone:** The library can be installed in a new project and used without copying code from the reference implementation.

### Testing strategy

| Layer | Approach |
|---|---|
| `src/codegen` | Pure functions over fixture JSON. Vitest unit tests plus `toMatchFileSnapshot` for emitted `.js`/`.d.ts`. |
| `src/core` | Runtime code must depend on the SDK only through JSDoc types (erased at runtime), never on SDK classes (`instanceof Table` etc.). Tests pass plain structural fakes implementing `getCellValue`, `createRecordsAsync`, `checkPermissionsFor*`, and so on. This is the same invariant airgen keeps and is why its tests run in Node without the SDK. |
| `src/react` | `vi.mock("@airtable/blocks/interface/ui")` returning fake `useBase`/`useRecords`/`useCustomProperties`; `renderHook` from `@testing-library/react` under `jsdom`. |
| `src/cli` | Mock global `fetch`; assert request paths, headers presence (not values), retry behavior, and that no error message contains the token. Config-file read/write against a temp dir. |
| Static types | `tsc --noEmit` with `checkJs` over `src/` and `tests/types/*.js`. Type tests use `// @ts-expect-error` on invalid field keys and write values, so a regression that loosens a type fails the build. Vitest `expectTypeOf` is optional on top. |
| Live | `tests/live/` skipped unless `AIRKIT_LIVE=1` and `AIRTABLE_TOKEN` are set; runs `getBaseSchema` against the dev base and checks the normalized model, not exact field lists. |

Fixtures: one real capture from the dev base (schema only, kept out of `files`) and one synthetic base that includes every `FieldType` member and the awkward cases (duplicate names differing only by diacritics, lookups of lookups, empty select choices, synced fields).

## 9. Initial scope

The first release should focus on:

1. Reliable Airtable schema generation and typing.
2. Typed table/field resolution.
3. Generic field inspection and conversion.
4. Typed record mutations.
5. React integration with the Interface SDK.

Advanced query builders, generated specialized hooks, sophisticated schema migrations, runtime Web API access, and UI components should not block the initial release.

Application-specific business logic such as `useDealInfo` and `useCreateEstimate` should remain outside the core library and serve as integration examples.

## 10. Definition of done

The initial implementation is complete when a developer can:

1. Install the npm package in an existing Airtable Interface Extension project.
2. Initialize it using the CLI and an available Airtable PAT.
3. Select a base and the tables needed by the interface.
4. Generate declarations for all selected fields.
5. Receive accurate field-name and value-type autocomplete in JavaScript.
6. Read, query, and mutate records using generic utilities and React hooks.
7. Regenerate the schema when Airtable changes.
8. Receive clear validation messages when the runtime base differs from the generated schema.

The result should be a reusable toolkit, not a framework that dictates the structure of the entire application.

## 11. Development base and integration consumers

- **Dev base:** `appJVUOH1y8koycl1` = "AFSP: Financeiro" (same base; confirmed from the airgen header in `afsp_finance/frontend/airtable-schema.ts`). Table names are Portuguese with diacritics (`Contas Bancárias`, `Lançamentos`), which makes it a good alias-generation test.
- **Credentials:** the Blocks CLI token on this machine cannot read schema (§2). Create a PAT with `schema.bases:read` scoped to this base and keep it in `.env` as `AIRTABLE_TOKEN`.
- **Integration consumers:** `~/dev/antfood/internal/afsp_finance` and `afsp_profit_loss` are real interface extensions on `interface-alpha` + React 19 + ESLint flat config + Tailwind. Use `npm link airkit` there to validate `init`, `generate`, bundling through `block run`, and the React hooks (Phase 4 "migrate one existing application").
- **Source of `src/reference`:** the deals/estimates CRM project was not found under `~/dev/antfood` at depth 4; locate it before Phase 3 so the migration can be diffed against the original.

## 12. Open decisions

1. **Indentation:** 3 spaces (reference style) vs 2 (ecosystem default). Plan assumes 3; change `prettier.config.js` once and nothing else depends on it.
2. **TypeScript 7 vs 5.9:** `typescript@7.0.2` is the current latest. If `checkJs` or declaration emit from JSDoc misbehaves, pin `^5.9`; no other tooling depends on the choice.
3. **SDK peer range:** `>=0.0.0-0` admits any version. If a future `interface` stable release lands on `2.x`, tighten the range then.
4. **Generated file names:** `airtable-schema.js` / `airtable-schema.d.ts` (mirrors airgen) vs `airkit.schema.*`. Default to the airgen names so a consumer can swap one for the other.
5. **airgen convergence:** revisit after Phase 3 whether airgen's observer becomes an optional schema source for airkit, or airkit's generator replaces airgen's.
