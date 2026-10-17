/**
 * Consumer-style type assertions on the pre-bound hooks (stable flavor).
 * generator.test.js compiles this next to the generated `airtable-schema.ts`
 * under `tsc --strict`; every `@ts-expect-error` must be a real error. Never
 * run — the hooks are only called inside a function body.
 */

import {createTypedHooks} from 'airgen';
import type {FieldInspector, MutationResult, TypedRecord} from 'airgen';
import {airgenMeta, useFields, useMutations, useQuery} from './airtable-schema';
import type {TableRecordMap, TableWriteMap} from './airtable-schema';

export function hooks(row: TypedRecord<TableRecordMap, 'Projects'>): Array<Promise<MutationResult>> {
  const projects = useMutations('Projects');
  const fields = useFields('Projects');
  const inspector: FieldInspector = fields.status;
  const statusNames: string[] = inspector.choices.map(choice => choice.name);

  const done: Array<TypedRecord<TableRecordMap, 'Projects'>> = useQuery('Projects', {
    where: [{field: 'status', op: 'is', value: 'Done'}],
    search: {query: statusNames[0] ?? '', fields: ['name']},
  });

  // @ts-expect-error useQuery filters on the table's own field keys
  useQuery('Projects', {where: [{field: 'nope', op: 'empty'}]});
  // @ts-expect-error table keys are the generated ones
  useMutations('Nope');
  // Computed fields inspect too (useFields covers every read key); unknown keys don't.
  void fields.daysLeft.isWritable;
  // @ts-expect-error not a field of Projects
  void fields.nope;

  return [
    projects.update(row, 'budget', 12),
    projects.update(done[0], 'status', {name: 'Done'}),
    projects.updateFields('rec1', {name: 'Renamed', budget: null}),
    projects.create({name: 'New', tasks: [{id: 'recTask000000001'}]}),
    projects.clone(row, {omit: ['budget'], overrides: {name: 'Copy'}}),
    // @ts-expect-error write values are typed per field
    projects.update(row, 'budget', 'twelve'),
    // @ts-expect-error computed fields are not in the write type
    projects.update(row, 'daysLeft', 3),
    // @ts-expect-error selects write {id} | {name}, not a bare string
    projects.updateFields(row, {status: 'Done'}),
  ];
}

/** Rebinding with custom properties: keys are the generated table keys. */
export const custom = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta, {
  customProperties: {Projects: 'Projects table'},
});

export const badCustom = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta, {
  // @ts-expect-error only generated table keys can be repointed
  customProperties: {Nope: 'Nope table'},
});
