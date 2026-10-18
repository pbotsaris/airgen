/**
 * Custom properties: letting the Interface Designer repoint a table.
 *
 * Interface SDK only (`airgen/interface`). Re-bind `createTypedHooks` with
 * `customProperties` and each listed table gets a table picker in the
 * Interface Designer, defaulting to the generated table. A builder can then
 * point the extension at a look-alike table (a duplicated base, a second
 * "Tasks" table) without a code change.
 *
 * The pick is checked against the generated schema by field name, then
 * primary field, and every hook reads and writes it by its own IDs. A field
 * with a different type there blocks all writes to that table and reads as
 * absent (the pick is probably the wrong table); a missing field is a
 * warning, and only writes to that field are refused. On the stable or base
 * SDK the option falls back to the generated tables with a warning.
 *
 * The picker is keyed by the generated table's ID, so renaming the table
 * keeps the builder's choice across regenerations.
 */
import React from 'react';
import {createTypedHooks} from 'airgen/interface';
import {airgenMeta} from './airtable-schema';
import type {TableRecordMap, TableWriteMap} from './airtable-schema';

// Replace the generated file's binding with one that registers the pickers.
// The generated file in an interface extension imports from 'airgen/interface' too.
export const {useRecords, useMutations, useFields} = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta, {
  customProperties: {Projects: 'Projects table', Tasks: 'Tasks table'},
});

export function TaskBoard() {
  const tasks = useRecords('Tasks'); // the picked table, or the generated one
  const mutations = useMutations('Tasks');

  return (
    <div>
      {!mutations.validation.valid() && (
        // e.g. 'Field "Hours" on "Tasks (copy)" is a singleLineText, expected number'
        <p role="alert">{mutations.validation.reason()}</p>
      )}
      <ul>
        {tasks.map(task => (
          <li key={task.id}>{task.fields.title}</li>
        ))}
      </ul>
      <button disabled={!mutations.can.create().hasPermission} onClick={() => mutations.create({title: 'New'})}>
        Add
      </button>
    </div>
  );
}
