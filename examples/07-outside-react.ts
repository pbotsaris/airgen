/**
 * The runtime without hooks.
 *
 * Everything the generated hooks bind is a plain function exported from
 * airgen, so the same logic runs in event handlers, scripts, and tests. They
 * are written against structural SDK types (`SdkBase`, `SdkTable`,
 * `SdkRecord`): pass the real SDK objects, or a fake in tests.
 */
import {cloneValues, createMutations, findTable, groupRecords, inspectField, query} from 'airgen';
import type {MutationResult, SdkBase, TypedRecord} from 'airgen';
import {airgenMeta} from './airtable-schema';
import type {TableRecordMap, TasksWrite} from './airtable-schema';

type Task = TypedRecord<TableRecordMap, 'Tasks'>;

/** `createMutations` is what `useMutations` returns, built from a base (e.g. `useBase()`, or `base` from the SDK). */
export async function closeOutProject(base: SdkBase, tasks: ReadonlyArray<Task>): Promise<MutationResult> {
  const tableMeta = airgenMeta.tables.Tasks;
  const table = findTable(base, tableMeta); // by ID, name as fallback; null when hidden or deleted
  const mutations = createMutations<TasksWrite>(table, tableMeta);

  const open = query(tasks, {where: [{field: 'completed', op: 'empty'}]});
  return mutations.updateMany(open.map(task => ({record: task, fields: {status: {name: 'Done'}, completed: true}})));
}

/** Pure functions over `useRecords` rows: no SDK at all. */
export function hoursByAssignee(tasks: ReadonlyArray<Task>): Array<{assignee: string; hours: number}> {
  return groupRecords(tasks, {fields: ['assignee'], by: 'name'}).map(group => ({
    assignee: group.values[0] ?? 'Unassigned',
    hours: group.records.reduce((total, task) => total + (task.fields.hours ?? 0), 0),
  }));
}

/**
 * `inspectField` and `cloneValues` are the pieces behind `useFields` and
 * `clone`. `convertTo` turns any read value into the field's cell write
 * format (idempotent, so write values pass through unchanged).
 */
export function copyTask(base: SdkBase, task: Task) {
  const tableMeta = airgenMeta.tables.Tasks;
  const table = findTable(base, tableMeta);
  const statusMeta = tableMeta.fields.status;
  const status = inspectField(table?.getFieldByIdIfExists(statusMeta.id) ?? null, statusMeta, 'status');

  const asWriteValue = status.convertTo(task.fields.status); // {id: 'sel…'}
  const values = cloneValues<TasksWrite>(task, table, tableMeta, {omit: ['completed']});
  return {asWriteValue, values};
}
