/**
 * Reading records.
 *
 * `useRecords(tableKey)` wraps the SDK's `useRecords` for one generated table.
 * Each row is `{id, name, fields, raw}`: `name` is the primary field's display
 * string; `fields` is typed by the generated `ProjectsRecord` and keyed by the
 * sanitized field names ("Due Date" becomes `dueDate`); `raw` is the native
 * SDK record. Empty cells are absent, so every field is optional. Values are
 * the SDK's rich cell shapes: a select is `{id, name, color?}`, a link is
 * `{id, name}[]` (see `08-relations.tsx` to get the linked rows instead), a
 * collaborator has `email`, a lookup is `{linkedRecordId, value}[]`.
 *
 * Tables and fields resolve by ID, so renaming either in Airtable never
 * breaks a running extension. A table hidden from the extension reads as
 * `[]`, a hidden field as absent.
 */
import React from 'react';
import {cellNames, firstLinkedRecord, lookupValues} from 'airgen';
import {useRecords, useTable} from './airtable-schema';

export function ProjectList() {
  const projects = useRecords('Projects');

  return (
    <ul>
      {projects.map(project => {
        const {fields} = project;
        const status = fields.status?.name ?? 'No status'; // 'Planned' | 'Active' | 'Done'
        const owner = fields.owner?.name ?? fields.owner?.email ?? 'Unassigned';
        const tags = cellNames(fields.tags).join(', '); // names of a select, link, or collaborator cell
        const taskNames = lookupValues(fields.taskNames).join(', '); // lookup entries, unwrapped
        const thumbnail = fields.files?.[0]?.thumbnails?.small?.url;

        return (
          <li key={project.id}>
            {thumbnail && <img src={thumbnail} alt="" />}
            <strong>{fields.name}</strong> — {status} — {owner}
            <div>
              {fields.taskCount ?? 0} tasks ({fields.totalHours ?? 0} h): {taskNames}
            </div>
            <div>
              {tags} · due {fields.dueDate ?? 'whenever'} · {fields.daysLeft ?? '?'} days left
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The SDK table itself (`SdkTable | null`), for anything the typed layer doesn't cover. */
export function TaskCount() {
  const table = useTable('Tasks');
  const tasks = useRecords('Tasks');
  const firstProject = firstLinkedRecord(tasks[0]?.fields.project); // `{id, name} | null`

  return (
    <p>
      {table?.name ?? 'Tasks'}: {tasks.length} records
      {firstProject && <> — first links to {firstProject.name}</>}
    </p>
  );
}

/** `raw` is the native SDK record: use it for `getCellValueAsString`, `expandRecord`, etc. */
export function RawCell() {
  const [task] = useRecords('Tasks');
  const field = useTable('Tasks')?.getFieldByIdIfExists('fldTaskDue0000001');
  if (!task || !field) return null;

  return <span>{task.raw.getCellValueAsString(field)}</span>;
}
