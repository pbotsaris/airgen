/**
 * Writing records.
 *
 * `useMutations(tableKey)` returns a `MutableTable` typed by the generated
 * `TasksWrite`: field keys autocomplete and values must be in the SDK's cell
 * write format (`{id}` or `{name}` for a select, `{id}` for a collaborator or
 * link, `null` to clear). Computed fields are not in the write type at all.
 *
 * Nothing here throws. Every operation validates each field, checks
 * permissions for every batch of 50, and only then calls the SDK; the result
 * is `{ok: true, ids}` or `{ok: false, error, ids, failedBatch, issues}`,
 * where a failure's `ids` are the records that were already written.
 */
import React, {useState} from 'react';
import type {MutationResult, TypedRecord} from 'airgen';
import {useMutations, useRecords} from './airtable-schema';
import type {TableRecordMap} from './airtable-schema';

type Task = TypedRecord<TableRecordMap, 'Tasks'>;

/** One place to turn a result into UI: a toast, a banner, a console line. */
function report(result: MutationResult): string {
  if (result.ok) return `Saved ${result.ids.length} record(s)`;

  // `issues` carry the validation findings (`{kind, level, message, fieldKey?}`);
  // `failedBatch` is set only when the SDK rejected a batch mid-run.
  const partial =
    result.failedBatch !== null ? ` (${result.ids.length} written before batch ${result.failedBatch} failed)` : '';
  return `${result.error.message}${partial}`;
}

export function TaskActions({projectId}: {projectId: string}) {
  const tasks = useMutations('Tasks');
  const rows = useRecords('Tasks');
  const [message, setMessage] = useState('');
  const run = async (write: Promise<MutationResult>) => setMessage(report(await write));

  // `can.*` are the SDK's table-level permission checks; use them to disable UI before trying.
  const canCreate = tasks.can.create().hasPermission;
  const canDelete = tasks.can.delete().hasPermission;

  const create = () =>
    run(
      tasks.create({
        title: 'New task',
        status: {name: 'Todo'}, // or {id: 'selTodo000000001'}; both are typed against the choices
        priority: {name: 'Medium'},
        project: [{id: projectId}],
        due: new Date(), // dates take a string or a Date
      }),
    );

  const finish = (task: Task) => run(tasks.updateFields(task, {status: {name: 'Done'}, completed: true, hours: null}));

  const reassign = (task: Task, collaboratorId: string) => run(tasks.update(task, 'assignee', {id: collaboratorId}));

  // Read values are accepted as they are: the runtime converts `{id, name, color}` to `{id}`.
  const copyStatus = (from: Task, to: Task) => run(tasks.update(to, 'status', from.fields.status ?? null));

  // One SDK call per 50 records; the same `fields` on every entry sets one value on many records.
  const completeAll = () => run(tasks.updateMany(rows.map(record => ({record, fields: {completed: true}}))));

  // A copy of the writable, non-empty cells; computed fields and attachments are skipped.
  const duplicate = (task: Task) =>
    run(tasks.clone(task, {omit: ['completed'], overrides: {title: `${task.fields.title ?? 'Task'} (copy)`}}));

  const remove = (task: Task) => run(tasks.remove(task)); // a row, a record, or a bare id
  const removeDone = () => run(tasks.removeMany(rows.filter(task => task.fields.completed)));

  return (
    <div>
      <button disabled={!canCreate} onClick={create}>
        Add task
      </button>
      <button onClick={completeAll}>Complete all</button>
      <button disabled={!canDelete} onClick={removeDone}>
        Delete completed
      </button>
      <ul>
        {rows.map(task => (
          <li key={task.id}>
            {task.fields.title}
            <button onClick={() => finish(task)}>Done</button>
            <button onClick={() => reassign(task, 'usrSomeone0000001')}>Assign</button>
            <button onClick={() => duplicate(task)}>Duplicate</button>
            <button onClick={() => remove(task)}>Delete</button>
            {rows[0] && rows[0] !== task && <button onClick={() => copyStatus(rows[0], task)}>Copy status</button>}
          </li>
        ))}
      </ul>
      <p>{message}</p>
    </div>
  );
}

/**
 * Table-level problems (the table is hidden from this extension, or a
 * custom-property pick is incompatible, see 06-custom-properties.tsx) refuse
 * every write and deny every `can.*` check. They are on `validation`.
 */
export function WriteStatus() {
  const projects = useMutations('Projects');
  if (projects.validation.valid()) return null;
  return <p role="alert">{projects.validation.reason()}</p>;
}
