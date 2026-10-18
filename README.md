# airgen

Typed [Airtable Custom Extensions](https://airtable.com/developers/extensions): a reactive TypeScript generator plus a typed runtime, built on the official [Blocks SDK](https://github.com/Airtable/blocks).

A `<SchemaObserver />` inside your extension watches the live base schema through the SDK and streams a generated `airtable-schema.ts` to a local daemon that writes it to disk. The file carries read and write types for every table, the IDs behind them, and hooks already bound to your schema: `useRecords`, `useMutations`, `useFields`, `useQuery`, `useSchemaDrift`. No API token and no manual regeneration: rename a field in Airtable and the types update within a second while `block run` hot-reloads your extension.

![diagram](https://raw.githubusercontent.com/pbotsaris/airgen/main/docs/dia.jpeg)

## Requirements

- An extension scaffolded with the [Airtable CLI](https://airtable.com/developers/extensions) (`block init`) and run with `block run`. airgen only works inside an extension; there is no REST path.
- Peer dependencies from that scaffold: `@airtable/blocks >= 1.10.0` (or an `interface-alpha` build) and `react >= 16.14`.
- Node `>= 18` for the daemon.

## Quick start

```sh
npm install --save-dev airgen
npx airgen            # starts the schema daemon, then `block run`
```

Render the observer during development, importing from the entry that matches your SDK:

| Your extension | Import airgen from |
|---|---|
| Interface extension (`@airtable/blocks@interface-alpha`) | `airgen/interface` |
| Custom extension, stable SDK (`@airtable/blocks@1.x`) | `airgen` |
| Custom extension, experimental SDK (`@airtable/blocks/base/ui`) | `airgen/base` |

```tsx
import {SchemaObserver} from 'airgen/interface'; // or 'airgen'
import {airgenMeta} from './airtable-schema'; // optional: shows schema drift in the panel

function App() {
  return (
    <>
      <SchemaObserver meta={airgenMeta} /> {/* dev only: remove or enabled={false} before release */}
      <MyExtension />
    </>
  );
}
```

The generated file lands at `frontend/airtable-schema.ts`. Commit it: it is the source of truth when no dev session is running. Then import the hooks from it:

```tsx
import {useRecords, useMutations} from './airtable-schema';

const projects = useRecords('Projects'); // table keys autocomplete
projects[0]?.fields.status?.name; // 'Planned' | 'Active' | 'Done'
projects[0]?.fields.owner?.email; // string | undefined

const tasks = useMutations('Tasks');
await tasks.create({title: 'Kickoff', status: {name: 'Todo'}, project: [{id: projects[0].id}]});
```

This works from plain `.js` files too: the generics are bound inside the generated file, so the editor infers everything at the call site.

## What you get

- **Read types that match `record.getCellValue`**: selects are `{id, name, color?}` literal unions, links `{id, name}[]`, collaborators carry `email`, lookups are `{linkedRecordId, value}[]`, formulas and rollups resolve to their result type.
- **Write types in the SDK's cell write formats**: one `<Table>Write` per table with only the writable fields; selects take `{id}` or `{name}`, dates a `string | Date`, anything `null` to clear.
- **`airgenMeta`**: every table, field, and choice ID, with `isComputed` and `primaryFieldId`. Everything at runtime resolves by ID, so renames in Airtable never break a running extension.
- **Pre-bound hooks** and the plain functions behind them, usable outside React.

Field keys are the Airtable names, transliterated and camelCased (`Due Date` becomes `dueDate`); the raw name is kept in the meta. Details in [docs/generated-file.md](docs/generated-file.md).

## Runtime

Every example below is a file in [`examples/`](examples/), written against a generic project-tracker base and typechecked by the test suite.

**Reading** ([01](examples/01-reading.tsx)): `useRecords(key)` rows are `{id, fields, raw}`; `useTable(key)` is the SDK table. Helpers `lookupValues`, `cellNames`, `cellIds`, `firstLinkedRecord` flatten the rich shapes.

**Fields** ([02](examples/02-fields.tsx)): `useFields(key)` gives a `FieldInspector` per field, with the live choices and colors, `isWritable`, and the `validation` a write would hit.

**Writes** ([03](examples/03-writes.tsx)): `useMutations(key)` has `create`, `createMany`, `update`, `updateFields`, `updateMany`, `remove`, `removeMany`, `clone`, and `can.create/update/delete`. Nothing throws: every write validates each field and checks permissions per batch of 50 before touching the SDK, and returns `{ok: true, ids}` or `{ok: false, error, ids, failedBatch, issues}`. Read values are accepted as write values and converted.

```tsx
const result = await tasks.updateFields(task, {status: {name: 'Done'}, completed: true});
if (!result.ok) toast(result.error.message);
```

**Queries** ([04](examples/04-queries.tsx)): `useQuery(key, {where, match, search})` filters by field key (`is`, `not`, `anyOf`, `noneOf`, `empty`, `notEmpty`; selects, links, and collaborators match by id, name, or email) and searches with a pluggable `SearchMatcher` (`@airgen/ui` ships a fuse.js one). `groupRecords` groups by one or more fields.

**Drift** ([05](examples/05-drift.tsx)): `useSchemaDrift()` compares the live schema with the meta in a released extension, no daemon involved. Deletions and type changes are breaking, removed choices warn, renames are info.

**Custom properties** ([06](examples/06-custom-properties.tsx), interface SDK): re-bind `createTypedHooks(airgenMeta, {customProperties: {Tasks: 'Tasks table'}})` and the Interface Designer gets a table picker per listed table. A picked look-alike table is matched by field name and validated against the generated types; a mismatch blocks writes instead of writing the wrong shape.

**Outside React** ([07](examples/07-outside-react.ts)): `createMutations`, `inspectField`, `cloneValues`, `query`, `groupRecords`, and `findTable` are plain functions over structural SDK types, for event handlers, scripts, and tests.

## Development tooling

- **Typecheck panel.** `block run` never typechecks, so after every schema write the daemon runs your project's own `tsc` and the observer panel shows the errors a schema change caused in your code.
- **Code fixes under `--fix`.** The daemon diffs the generated file by ID, so a rename is a fact, and offers to rewrite `record.fields.contactEmail` style usages across `.ts` and `.js` files.
- **CLI and config.** `npx airgen [-p port] [-o path] [--daemon-only] [--fix] [-- block run args]`, or `airgen-config.json`. The daemon lives in the `block run` process and exits with it.

Guides: [typecheck and fixes](docs/typecheck-and-fixes.md), [CLI, daemon, and security](docs/cli-and-daemon.md).

## Upgrading to 0.4.0

Regenerate once under `npx airgen` and commit the file. Two things can need code changes: lookup cells are now `Array<LookupValue<T>>` instead of bare values, and the meta is version 2. See [docs/upgrading.md](docs/upgrading.md) and the [changelog](CHANGELOG.md).

## API

Exported identically from `airgen`, `airgen/interface`, and `airgen/base`:

| Export | Description |
|---|---|
| `SchemaObserver` | Dev panel. Props: `daemonUrl` (`http://localhost:3001`), `debounceMs` (500), `enabled` (true), `meta`. |
| `useRecords`, `useTable`, `useFields`, `useMutations`, `useQuery`, `useSchemaDrift` | From the **generated file**, pre-bound to your schema. |
| `createTypedHooks<M, W>(airgenMeta, options?)` | What the generated file calls; re-bind it yourself for `customProperties`. |
| `createMutations`, `inspectField`, `cloneValues`, `query`, `groupRecords`, `cellText`, `findTable`, `resolveTableOverride` | The runtime as plain functions. |
| `lookupValues`, `firstLookupValue`, `cellIds`, `cellNames`, `firstLinkedRecord` | Read helpers over cell shapes. |
| `checkSchemaDrift(base, airgenMeta)` | Pure drift check behind `useSchemaDrift`. |
| `generateTypeScriptFromBase(base, options?)`, `computeSchemaSignature(base)` | The generator, for a custom sync flow. |

Maintainers: [docs/releasing.md](docs/releasing.md). This repo also holds [`@airgen/ui`](packages/ui/README.md), Airtable-native React components that pair with the generated meta.
