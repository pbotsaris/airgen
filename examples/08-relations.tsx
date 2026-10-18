/**
 * Relations: `include`.
 *
 * Airtable links are the base's relationships, and the schema records where
 * every link points, so airgen derives them — nothing to declare. Pass
 * `{include}` to `useRecords` (or `useQuery`) naming the links to follow, and
 * those cells hold the linked table's typed rows instead of `{id, name}`
 * stubs: `true` hydrates one link, an object hydrates and keeps going, at most
 * two links deep. A link back to a table already on the path (Projects →
 * tasks → project) and a key that isn't a link are compile errors.
 *
 * Each included key is one SDK `useRecords(linkedTable)`, the same load you
 * would otherwise do by hand, so keep the include's *shape* static per call
 * site, like hook deps. A link whose record isn't loaded (deleted, hidden) is
 * dropped from the hydrated cell. Every row, hydrated or not, carries `name`:
 * the SDK's primary-field display string.
 */
import React from 'react';
import {useQuery, useRecords} from './airtable-schema';

/** One link deep: each project's tasks as `TasksRecord` rows. */
export function ProjectsWithTasks() {
  const projects = useRecords('Projects', {include: {tasks: true}});

  return (
    <ul>
      {projects.map(project => (
        <li key={project.id}>
          <strong>{project.name}</strong> — {project.fields.status?.name ?? 'No status'}
          <ul>
            {project.fields.tasks?.map(task => (
              <li key={task.id}>
                {task.fields.title} · {task.fields.status?.name ?? 'Todo'} · {task.fields.hours ?? 0} h
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Two links deep: a person's projects, and each project's tasks. */
export function Workload() {
  const people = useRecords('People', {include: {projects: {tasks: true}}});

  return (
    <table>
      <tbody>
        {people.map(person => {
          const projects = person.fields.projects ?? [];
          const openTasks = projects.flatMap(project =>
            (project.fields.tasks ?? []).filter(task => task.fields.status?.name !== 'Done'),
          );
          return (
            <tr key={person.id}>
              <td>{person.name}</td>
              <td>{projects.map(project => project.name).join(', ')}</td>
              <td>{openTasks.length} open tasks</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * `useQuery` takes the same include. Filters still name the table's own
 * fields; a filter on a hydrated link matches the linked rows by id or name.
 */
export function ProjectsWithOpenTasks() {
  const projects = useQuery('Projects', {
    include: {tasks: true},
    where: [
      {field: 'tasks', op: 'notEmpty'},
      {field: 'status', op: 'not', value: 'Done'},
    ],
  });

  return (
    <ul>
      {projects.map(project => (
        <li key={project.id}>
          {project.name}: {project.fields.tasks?.filter(task => task.fields.status?.name !== 'Done').length} open
        </li>
      ))}
    </ul>
  );
}
