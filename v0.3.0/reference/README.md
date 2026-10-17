# Reference code (migration source material)

Plain-JS + JSDoc code copied from an existing Antfood interface extension (a deals/estimates CRM). It is **not** part of airgen and does not run on its own: it imports modules that were not copied (`../components/recordOptions.js`, `../components/utils.js`, `../context/SheetContext.jsx`, `../context/ToastContext.jsx`, `../estimates/duplicateEstimate.js`), and it depends on a hand-written `config/schemaRegistry.js` that airgen's generated `airgenMeta` replaces.

Keep this folder out of `tsconfig`, lint, tests, and `files`. Delete it once the port in `docs/PLAN.md` Phases 2–3 is done.

Style: 3-space indent, double quotes. Reformat to airgen's style (2-space, single quotes) when porting, not before.

## What ports where

| Reference file | Role | Target in airgen | Notes |
|---|---|---|---|
| `airtable/fields.js` | `FieldInspector`: field metadata + `convertTo` read→write value conversion | `src/client/runtime/fields.ts` | Central piece. Drop the UI-oriented option helpers (`recordOptions`) or put them behind an adapter. |
| `airtable/normalize.js` | Read cell values into plain shapes (select, collaborator, linked, lookup, number, date) | `src/client/runtime/normalize.ts` | Overlaps with what `useRecords` already does; keep only the helpers that add value over raw `getCellValue`. |
| `airtable/airtableTypes.js` | Type constants / groupings of `FieldType` | fold into `fields.ts` | airgen's generator already has the per-type switch; share one table. |
| `airtable/mutations.js` | `MutableTable<F>`: create/update/delete, permission checks, batches of 50, `[ok, error]` results | `src/client/runtime/mutations.ts` | Make generic over the generated `TableWriteMap`. Fields resolved by meta ID instead of a field group object. |
| `airtable/cloneRecord.js` | Copy writable values from a record | `src/client/runtime/clone.ts` | Needs the computed/read-only flag that meta v2 adds. |
| `airtable/queries.js`, `airtable/airtableUtils.js` | Filter (`eq/neq/anyOf/noneOf/empty`, AND/OR), group by, fuzzy search (`fuse.js`) | `src/client/runtime/queries.ts` | Operate on `useRecords` output. `fuse.js` is already a dependency of `@airgen/ui`; decide whether it belongs in the core package. |
| `config/ValidationResult.js` | Warnings vs blocking errors | `src/client/runtime/validation.ts` | Keep the semantics: incompatible types block writes. |
| `config/schemaResolver.js`, `config/configResolver.js` | Resolve tables/fields by alias/override, check types, collect issues | `src/client/runtime/resolver.ts` | Only the *override* path survives: validating a runtime-selected table against the generated meta. The alias/registry path is replaced by `airgenMeta`. |
| `config/customProperties.js` | Build Interface custom-property definitions (one enum per table), read selected table IDs | `src/client/runtime/customProperties.ts` | Interface-SDK only (`useCustomProperties`). Goes behind the adapter. |
| `config/schemaRegistry.js` | Hand-written schema + typedefs | *(not ported)* | This is exactly what the generator replaces. Useful only to see what field groups the app used. |
| `hooks/useConfig.js`, `hooks/useConfigTable.js` | React entry point: `useBase` + `useCustomProperties` + overrides table → `resolveConfig` | `createTypedHooks` additions | Becomes `useAirgenConfig()` / options on `createTypedHooks`. The 2/3-column overrides table is optional; keep if still used. |
| `hooks/useTableMutations.js` | Per-table `@overload`s mapping key → `MutableTable` | `useMutations(tableKey)` on `createTypedHooks` | The overloads disappear; the generic is bound by the generated file. |
| `hooks/useMutationRunner.js` | Run a mutation with toast + busy state | *(example only)* | Depends on `ToastContext`; UI concern, possibly `@airgen/ui`. |
| `hooks/useQuery.js` | `useMemo` wrapper over `queries.js` | `useQuery(tableKey, spec)` | Trivial once queries are typed. |
| `hooks/useListView.js`, `utils/listOps.js` | List selection/sorting helpers | *(example only)* | Not Airtable-specific. |
| `utils/utils.js`, `utils/DateFormatter.js` | Misc helpers | pick what `fields.ts` needs | Date parsing/formatting is reused by conversion. |

## App-specific hooks (integration examples only)

`useDealInfo`, `useCreateEstimate`, `useDuplicateEstimate`, `useEstimateEditor`, `useEstimateInfo`, `useEstimateScenarios`, `useLicenseTerms`, `useLicenseTermItems`, `useNotes`, `useNoteItems`, `useNoteTemplates`, `useOrganizationInfo`, `useService`, `useServiceItems`, `useStages`, `useStudio`.

They show how the runtime pieces compose in a real app: `useConfig` → `config.fields.<group>` → `normalize.*` for reads, `useTableMutations(key)` + `useMutationRunner` for writes. Read them to design the hook API; do not port them.

## Pipeline the reference implements (for orientation)

1. `schemaRegistry.js` declares tables (key, aliases, custom-property `idKey`) and field groups (aliases, allowed `types`, `required`, `primary`).
2. `schemaResolver.js` resolves each table by alias and each field by: config-table override → case-insensitive alias → primary-field fallback, checking types and collecting issues.
3. `ValidationResult.js` splits issues into warnings and blocking errors.
4. `configResolver.js` returns `{ config: { tables, fields, custoProps }, validation }`.
5. `useConfig.js` wires `useBase` + `useCustomProperties` (+ optional overrides table) into step 4.
6. `MutableTable` writes through `FieldInspector.convertTo`, checks permissions, batches by 50.

In airgen, steps 1–2 collapse to `airgenMeta` (IDs are canonical), step 5 becomes part of `createTypedHooks`, and steps 3, 4, 6 are ported as-is.
