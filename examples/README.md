# airgen examples

Short, commented files showing the library end to end against a generic project-tracker base (Projects, Tasks, People). Read them in order:

| File | Shows |
|---|---|
| `00-setup.tsx` | `SchemaObserver` in development, which entry point to import from |
| `01-reading.tsx` | `useRecords`, `useTable`, typed cell shapes, `name`, `raw`, the normalize helpers |
| `02-fields.tsx` | `useFields`: live choices, writability, `validation`, `getChoiceByName` |
| `03-writes.tsx` | `useMutations`: create, update, updateMany, clone, remove, results, `can.*` |
| `04-queries.tsx` | `useQuery` filters and search, custom matchers, `groupRecords`, `aggregate`, `cellText` |
| `05-drift.tsx` | `useSchemaDrift` in a released extension |
| `06-custom-properties.tsx` | interface SDK: re-binding `createTypedHooks` with table pickers |
| `07-outside-react.ts` | the same runtime as plain functions: `createMutations`, `query`, `aggregate`, `inspectField`, `cloneValues` |
| `08-relations.tsx` | `include`: link cells hydrated with the linked table's rows, one and two links deep, in `useRecords` and `useQuery` |
| `09-formatting.tsx` | `format`, `formatCell`, `parse`: values rendered and read back by each field's settings |

`airtable-schema.ts` is what airgen generates for that base (`test/fixtures/example-base.js`), stable-SDK flavor. In an interface extension the only difference is its import line (`airgen/interface`), which also admits `{name}` links (create-and-link). Every example imports the hooks from it, exactly as a consumer would.

These files are not shipped. `generator.test.js` regenerates the schema (refresh with `UPDATE_SNAPSHOTS=1` after an intended output change) and typechecks every example under `tsc --strict` with airgen resolved like a consumer package, so they can't drift from the library. `tsconfig.json` here only serves the editor and needs a prior `npm run build`.
