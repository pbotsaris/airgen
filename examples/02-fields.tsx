/**
 * Field metadata.
 *
 * `useFields(tableKey)` returns a `FieldInspector` per field key, built from
 * the live SDK field with the generated meta as fallback. Use it for what the
 * types can't tell you at compile time: the choices a select has *right now*
 * (and their colors), whether a field is writable, and whether a write to it
 * would be refused (`validation`). Inspectors are rebuilt on every render and
 * re-render on schema changes, so a choice added in Airtable shows up
 * immediately.
 */
import React from 'react';
import {useFields, useMutations} from './airtable-schema';
import type {TasksRecord, TasksStatusChoice} from './airtable-schema';

export function StatusPicker({task}: {task: {id: string; fields: Partial<TasksRecord>}}) {
  const fields = useFields('Tasks');
  const tasks = useMutations('Tasks');
  const status = fields.status; // FieldInspector

  // The write type wants the generated literal union, and a DOM value is a
  // string: narrow it against the live choices. A choice added in Airtable
  // since generation passes too; the runtime sends the id as it is.
  const isStatusId = (id: string): id is TasksStatusChoice['id'] => status.choices.some(choice => choice.id === id);
  const pick = (id: string) => tasks.update(task, 'status', isStatusId(id) ? {id} : null);

  // `choices` are the live ones: `[{id, name, color?}]` in Airtable's display order.
  // A lookup or formula resolving to a select has choices too (`fields.projectStatus.choices`).
  return (
    <label>
      {status.name /* live display name, even if the field was renamed since generation */}
      <select
        disabled={!status.isWritable}
        value={task.fields.status?.id ?? ''}
        onChange={event => pick(event.target.value)}
      >
        <option value="">—</option>
        {status.choices.map(choice => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Which of this table's fields can be written, and why not when they can't. */
export function WritableFields() {
  const fields = useFields('Projects');

  return (
    <ul>
      {Object.values(fields).map(inspector => (
        <li key={inspector.fieldKey}>
          {inspector.name} ({inspector.type}): {inspector.isWritable ? 'writable' : 'read-only'}
          {/* `validation` holds the issues a write would raise: a hidden field, a type change, a computed field. */}
          {!inspector.validation.valid() && <em> — {inspector.validation.reason()}</em>}
        </li>
      ))}
    </ul>
  );
}

/** Choices by name, for mapping user input to a select value. */
export function usePriorityByName(name: string) {
  const fields = useFields('Tasks');
  return fields.priority.getChoiceByName(name); // case-insensitive; `{id, name, color?} | null`
}
