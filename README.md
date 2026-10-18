# airgen

A type-safe development experience for [Airtable Custom Extensions](https://airtable.com/developers/extensions).

Combines reactive TypeScript type generation with a typed runtime built on the official [Airtable Blocks SDK](https://github.com/Airtable/blocks).

A `<SchemaObserver />` component inside your extension monitors the live Airtable base schema and sends generated types to a local daemon, which writes them to `airtable-schema.ts`.

The generated file includes read and write types for every table, table and field IDs, and schema-aware hooks: `useRecords`, `useMutations`, `useFields`, `useQuery`, and `useSchemaDrift`.

**No API tokens or manual regeneration required.** 
Rename a field in Airtable, and your types update automatically, while `block run` hot-reloads your extension.

![Architecture diagram](https://raw.githubusercontent.com/pbotsaris/airgen/main/docs/dia.png)

## Requirements

- An extension scaffolded with the [Airtable CLI](https://airtable.com/developers/extensions) (`block init`) and run with `block run`. 
- airgen only works inside an extension; there is no REST path.
- Peer dependencies from that scaffold: `@airtable/blocks >= 1.10.0` (or an `interface-alpha` build) 
- React `>= 16.14`.
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

The generated file lands at `frontend/airtable-schema.ts`. Commit it: it is the source of truth when no dev session is running. 

Then import the hooks from it:

```tsx
import {useRecords, useMutations} from './airtable-schema';

const projects = useRecords('Projects'); // table keys autocomplete
projects[0]?.fields.status?.name; // 'Planned' | 'Active' | 'Done'
projects[0]?.fields.owner?.email; // string | undefined

const people = useRecords('People', {include: {projects: {tasks: true}}}); // follow links, typed
people[0]?.fields.projects?.[0].fields.tasks?.[0].fields.title; // string | undefined

const tasks = useMutations('Tasks');
await tasks.create({title: 'Kickoff', status: {name: 'Todo'}, project: [{id: projects[0].id}]});
```

This works from plain `.js` files too: the generics are bound inside the generated file, so the editor infers everything at the call site.

## What you get

- **Read types that match `record.getCellValue`**: 
    - selects are `{id, name, color?}` literal unions.
    - links `{id, name}[]` 
    - collaborators carry `email` 
    - lookups are `{linkedRecordId, value}[]` 
    - formulas and rollups resolve to their result type.
- **Write types in the SDK's cell write formats**: 
    - one `<Table>Write` per table with only the writable fields 
    - selects take `{id}` or `{name}`
    - dates a `string | Date` 
    - anything `null` to clear.
- **`airgenMeta`**: every table, field, and choice ID, with `isComputed` and `primaryFieldId`.
- Everything at runtime resolves by ID, so renames in Airtable never break a running extension.
- **Pre-bound hooks** and the plain functions behind them, usable outside React.

Field keys are the Airtable names, transliterated and camelCased (`Due Date` becomes `dueDate`).

the raw name is kept in the meta. Details in [docs/generated-file.md](docs/generated-file.md).
## Runtime

Practical examples are available in the [`examples/`](examples/) directory.

##### [Reading](examples/01-reading.tsx)

- `useRecords(key)` returns typed records with `{id, name, fields, raw}`.
- `useTable(key)` returns the SDK table.
- `lookupValues`, `cellNames`, `cellIds`, and `firstLinkedRecord` simplify Airtable cell values.

##### [Relations](examples/08-relations.tsx)

`useRecords(key, {include})` follows link fields into the linked table's typed rows, up to two links deep. Relationships come from the schema, so there is nothing to declare:

```tsx
const people = useRecords('People', {include: {projects: {tasks: true}}});
people[0]?.fields.projects?.[0].fields.tasks?.[0].fields.title;
```

Cycles, non-link keys, and a third level are compile errors. Details in [docs/relations.md](docs/relations.md).

##### [Fields](examples/02-fields.tsx)

`useFields(key)` provides a `FieldInspector` for each field, including:

- Live choices and colors
- Write permissions (`isWritable`)
- Validation rules (`validation`)

##### [Writes](examples/03-writes.tsx)

`useMutations(key)` provides typed operations:

- **Create:** `create`, `createMany`
- **Update:** `update`, `updateFields`, `updateMany`
- **Delete:** `remove`, `removeMany`
- **Clone:** `clone`
- **Permissions:** `can.create`, `can.update`, `can.delete`

All writes validate fields and permissions before execution. Batch operations process up to 50 records at a time.

Operations return results instead of throwing exceptions. Read values are automatically converted to valid write values.

```tsx
const result = await tasks.updateFields(task, {
  status: {name: 'Done'},
  completed: true,
});

if (!result.ok) toast(result.error.message);
```

##### [Queries](examples/04-queries.tsx)

`useQuery(key, {where, match, search, include})` provides typed filtering and searching.

- **Filters:** `is`, `not`, `anyOf`, `noneOf`, `empty`, `notEmpty`
- **Matching:** Selects, linked records, and collaborators by ID, name, or email
- **Search:** Pluggable `SearchMatcher`, including a Fuse.js implementation in `@airgen/ui`
- **Grouping:** `groupRecords` groups records by one or more fields
- **Aggregation:** `aggregate` sums, averages, min/max and counts over records or each group; numeric ops only accept numeric fields

##### [Schema Drift](examples/05-drift.tsx)

`useSchemaDrift()` compares the live base schema against the generated metadata in a released extension.

- **Breaking:** Deleted fields and type changes
- **Warning:** Removed select choices
- **Info:** Renamed fields

Works without the local daemon.

##### [Custom Properties](examples/06-custom-properties.tsx)

Bind tables to Interface Designer properties:

```tsx
createTypedHooks(airgenMeta, {
  customProperties: {Tasks: 'Tasks table'},
});
```

Users can select tables directly in Interface Designer. Selected tables are validated against the generated schema, preventing writes to incompatible fields.

##### [Outside React](examples/07-outside-react.ts)

Use standalone functions without React hooks:

`createMutations`, `inspectField`, `cloneValues`, `query`, `groupRecords`, `aggregate`, `findTable`

Useful for event handlers, scripts, and tests.

## Development Tooling

##### Typechecking

`block run` doesn't typecheck your code. Airgen runs your project's TypeScript compiler (`tsc`) after each schema update.

Errors caused by schema changes appear directly in the `<SchemaObserver />` panel.

##### Automatic Fixes

Run with `--fix` to detect field renames and update references in `.ts` and `.js` files.

Airgen tracks fields by ID, allowing it to identify renames and update references such as `record.fields.contactEmail`.

##### CLI & Configuration

```bash
npx airgen [-p port] [-o path] [--daemon-only] [--fix] [-- block run args]
```

Alternatively, configure Airgen using `airgen-config.json`.

The daemon runs alongside `block run` and exits when it stops.

##### Documentation

- [Relations](docs/relations.md)
- [Typechecking & Fixes](docs/typecheck-and-fixes.md) 
- [CLI & Daemon](docs/cli-and-daemon.md)

## Upgrading

Regenerate your schema with `npx airgen` and commit the updated file. 0.4.0 adds `TableLinkMap` and `include` with no breaking changes; 0.3.0 changed lookup read types. See the [Upgrade Guide](docs/upgrading.md) and [Changelog](CHANGELOG.md).

## API

All exports are available from `airgen`, `airgen/interface`, and `airgen/base`.

| Export | Description |
|---|---|
| `SchemaObserver` | Development panel with schema monitoring and typechecking. |
| `useRecords`, `useTable`, `useFields`, `useMutations`, `useQuery`, `useSchemaDrift` | Schema-bound hooks exported from the generated file. |
| `createTypedHooks<M, W, L>` | Creates typed hooks with optional custom properties. |
| `createMutations`, `inspectField`, `cloneValues`, `query`, `groupRecords`, `aggregate`, `cellText`, `findTable`, `resolveTableOverride` | Standalone runtime utilities. |
| `lookupValues`, `firstLookupValue`, `cellIds`, `cellNames`, `firstLinkedRecord` | Helpers for reading Airtable cell values. |
| `checkSchemaDrift` | Compares live schema against generated metadata. |
| `generateTypeScriptFromBase`, `computeSchemaSignature` | Schema generation and signature utilities. |

### SchemaObserver Options

| Prop | Default | Description |
|---|---|---|
| `daemonUrl` | `http://localhost:3001` | Local daemon endpoint. |
| `debounceMs` | `500` | Delay before processing schema changes. |
| `enabled` | `true` | Enables schema observation. |
| `meta` | — | Generated schema metadata. |
| `children` | — | Content rendered below the panel, or alone when disabled. |

## Additional Packages

[`@airgen/ui`](packages/ui/README.md) provides Airtable-native React components that integrate with the generated schema.

**Development:** 
[Release Guide](docs/releasing.md)
[sandbox](docs/sandbox.md)
