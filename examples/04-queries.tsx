/**
 * Filtering, searching, grouping.
 *
 * `useQuery(tableKey, spec)` is `query(useRecords(tableKey), spec)`: filters
 * on the table's own field keys, matched `all` (default) or `any`, plus an
 * optional text search. Selects, links, and collaborators match by id, name,
 * or email; lookups by their values. It is not memoized on purpose (the SDK
 * hands back the same records array when only cell values change), so wrap it
 * in your own `useMemo` only with a dependency that changes exactly when it
 * should.
 */
import React, {useState} from 'react';
import {aggregate, cellText, groupRecords} from 'airgen';
import type {SearchMatcher} from 'airgen';
import {useQuery, useRecords} from './airtable-schema';

export function ActiveProjects() {
  // Every filter must hold: status is Active and an owner is set.
  const active = useQuery('Projects', {
    where: [
      {field: 'status', op: 'is', value: 'Active'},
      {field: 'owner', op: 'notEmpty'},
    ],
  });

  // `anyOf` / `noneOf` take a list; on a multi-value cell any element counts.
  const creative = useQuery('Projects', {where: [{field: 'tags', op: 'anyOf', value: ['Design', 'Marketing']}]});

  // `match: 'any'`: at least one filter holds.
  const urgent = useQuery('Tasks', {
    match: 'any',
    where: [
      {field: 'priority', op: 'is', value: 'High'},
      {field: 'due', op: 'notEmpty'},
    ],
  });

  return (
    <p>
      {active.length} active, {creative.length} creative, {urgent.length} urgent tasks
    </p>
  );
}

/** Text search over chosen fields; the default matcher is an accent- and case-insensitive token match. */
export function ProjectSearch() {
  const [text, setText] = useState('');
  const found = useQuery('Projects', {search: {query: text, fields: ['name', 'notes']}});

  return (
    <>
      <input value={text} onChange={event => setText(event.target.value)} placeholder="Search projects" />
      <ul>
        {found.map(project => (
          <li key={project.id}>{project.fields.name}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * Any `SearchMatcher` can rank results instead: given one text per record and
 * the query, return the matching indices, best first. `@airgen/ui` exports a
 * fuse.js-backed `fuseMatcher` with this signature (airgen itself depends on
 * nothing), so `search: {query, fields, matcher: fuseMatcher}` is fuzzy search.
 */
const prefixMatcher: SearchMatcher = (texts, query) =>
  texts.flatMap((text, index) => (text.toLowerCase().startsWith(query.toLowerCase()) ? [index] : []));

export function PrefixSearch({query}: {query: string}) {
  const found = useQuery('People', {search: {query, fields: ['name', 'email'], matcher: prefixMatcher}});
  return <span>{found.length} match(es)</span>;
}

/**
 * `groupRecords` groups rows by one or more fields, in first-seen order. A
 * multi-value cell (tags, links) puts its record in one group per value;
 * several fields group by every combination. Groups are keyed by name by
 * default, or by id (`by: 'id'`) when names may collide or change.
 */
export function TasksByStatus() {
  const tasks = useRecords('Tasks');
  const groups = groupRecords(tasks, {fields: ['status']});

  return (
    <>
      {groups.map(group => (
        <section key={group.key}>
          <h3>{group.values[0] ?? 'No status'}</h3>
          <ul>
            {group.records.map(task => (
              // `cellText` renders any cell as display text (names over ids, arrays comma-joined).
              <li key={task.id}>
                {task.fields.title} — {cellText(task.fields.assignee)} — {cellText(task.fields.projectStatus)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function TasksByAssigneeAndPriority() {
  const tasks = useRecords('Tasks');
  const groups = groupRecords(tasks, {fields: ['assignee', 'priority'], by: 'id'});
  return (
    <ul>
      {groups.map(group => (
        <li key={group.key}>
          {group.values.join(' / ')}: {group.records.length}
        </li>
      ))}
    </ul>
  );
}

/**
 * `aggregate` reduces rows to numbers: `sum`, `avg`, `min`, `max` on numeric
 * fields (numbers, currency, percent, duration, rollups, numeric formulas and
 * lookups of numbers; anything else is a type error), plus `count`,
 * `countFilled`, `countEmpty` and `countDistinct` on any field. Empty cells
 * are skipped; `avg`/`min`/`max` are `null` when no record has a value. Run it
 * on a `useQuery` result, or on each group's records.
 */
export function OpenWork() {
  const open = useQuery('Tasks', {where: [{field: 'completed', op: 'empty'}]});
  const {hours, average, people} = aggregate(open, {
    hours: {field: 'hours', op: 'sum'},
    average: {field: 'hours', op: 'avg'},
    people: {field: 'assignee', op: 'countDistinct'},
  });

  const byStatus = groupRecords(open, {fields: ['status']}).map(group => ({
    status: group.values[0] ?? 'No status',
    ...aggregate(group.records, {hours: {field: 'hours', op: 'sum'}, tasks: {op: 'count'}}),
  }));

  return (
    <>
      <p>
        {hours} open hours across {people} people (avg {average?.toFixed(1) ?? '–'} per task)
      </p>
      <ul>
        {byStatus.map(row => (
          <li key={row.status}>
            {row.status}: {row.tasks} tasks, {row.hours} h
          </li>
        ))}
      </ul>
    </>
  );
}
