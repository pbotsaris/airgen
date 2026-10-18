import * as React from 'react';
import {describe, expect, test, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';

import {NestedRecordTable, type NestedSpec} from '../src/components/NestedRecordTable';

// Shapes mirror airgen's `IncludedRecord`: an included link holds full rows,
// a link that was not included holds `{id, name}` stubs.
interface TaskRecord {
  id: string;
  name: string;
  fields: {title?: string; done?: boolean; project?: Array<{id: string; name: string}>};
  raw: unknown;
}

interface ProjectRecord {
  id: string;
  name: string;
  fields: {name?: string; status?: {id: string; name: string; color?: string}; tasks?: TaskRecord[]};
  raw: unknown;
}

interface PersonRecord {
  id: string;
  name: string;
  fields: {
    name?: string;
    email?: string;
    age?: number;
    projects?: ProjectRecord[];
    teams?: Array<{id: string; name: string}>;
  };
  raw: unknown;
}

const task = (id: string, title: string, done = false): TaskRecord => ({
  id,
  name: title,
  fields: {title, done, project: [{id: 'proj1', name: 'Website'}]},
  raw: null,
});

const website: ProjectRecord = {
  id: 'proj1',
  name: 'Website',
  fields: {
    name: 'Website',
    status: {id: 'sel1', name: 'Active'},
    tasks: [task('task1', 'Design'), task('task2', 'Build', true)],
  },
  raw: null,
};
const app: ProjectRecord = {
  id: 'proj2',
  name: 'App',
  fields: {name: 'App', status: {id: 'sel2', name: 'Paused'}},
  raw: null,
};

const people: PersonRecord[] = [
  {id: 'rec1', name: 'Ana', fields: {name: 'Ana', email: 'ana@x.com', projects: [website, app]}, raw: null},
  {id: 'rec2', name: 'Bruno', fields: {name: 'Bruno', email: 'bruno@x.com'}, raw: null},
];

const spec: NestedSpec<PersonRecord> = {
  projects: {columns: ['name', 'status'], nested: {tasks: {columns: ['title', 'done']}}},
};

const axeOptions = {rules: {'color-contrast': {enabled: false}}};

describe('NestedRecordTable', () => {
  test('is collapsed by default and expands into one sub-table per included link', async () => {
    const user = userEvent.setup();
    render(<NestedRecordTable records={people} columns={['name', 'email']} nested={spec} />);

    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('button', {name: 'Expand row'})).toHaveLength(1);
    const bruno = screen.getByText('Bruno').closest('tr')!;
    expect(within(bruno).queryByRole('button')).toBeNull();

    await user.click(screen.getByRole('button', {name: 'Expand row'}));
    expect(screen.getByRole('heading', {level: 4, name: 'Projects (2)'})).toBeDefined();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    const projects = tables[1]!;
    expect(within(projects).getByRole('columnheader', {name: 'Name'})).toBeDefined();
    expect(within(projects).getByRole('columnheader', {name: 'Status'})).toBeDefined();
    expect(within(projects).getByText('Active')).toBeDefined();
    expect(within(projects).queryByText('Design')).toBeNull();

    await user.click(within(projects).getByRole('button', {name: 'Expand row'}));
    expect(screen.getByRole('heading', {level: 4, name: 'Tasks (2)'})).toBeDefined();
    const tasks = screen.getAllByRole('table')[2]!;
    expect(within(tasks).getByRole('columnheader', {name: 'Title'})).toBeDefined();
    expect(within(tasks).getByText('Design')).toBeDefined();
    expect(within(tasks).getByText('Yes')).toBeDefined();
    const appRow = within(projects).getByText('App').closest('tr')!;
    expect(within(appRow).queryByRole('button')).toBeNull();
  });

  test('emptyMessage keeps rows without linked records expandable', async () => {
    const user = userEvent.setup();
    render(
      <NestedRecordTable
        records={people}
        columns={['name']}
        nested={{projects: {columns: ['name'], title: 'Their projects', emptyMessage: 'No projects yet'}}}
      />,
    );

    const buttons = screen.getAllByRole('button', {name: 'Expand row'});
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(screen.getByRole('heading', {level: 4, name: 'Their projects (0)'})).toBeDefined();
    expect(screen.getByText('No projects yet')).toBeDefined();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  test('defaultExpanded opens every level or only the shallower ones', () => {
    const {rerender} = render(<NestedRecordTable records={people} columns={['name']} nested={spec} defaultExpanded />);
    expect(screen.getAllByRole('table')).toHaveLength(3);
    expect(screen.getByText('Build')).toBeDefined();

    rerender(<NestedRecordTable records={people} columns={['name']} nested={spec} defaultExpanded={1} />);
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.queryByText('Build')).toBeNull();
  });

  test('controlled expansion uses path keys and reports the full map', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const {rerender} = render(
      <NestedRecordTable
        records={people}
        columns={['name']}
        nested={spec}
        expanded={{rec1: true}}
        onExpandedChange={onExpandedChange}
      />,
    );

    const projects = screen.getAllByRole('table')[1]!;
    await user.click(within(projects).getByRole('button', {name: 'Expand row'}));
    expect(onExpandedChange).toHaveBeenCalledWith({rec1: true, 'rec1/projects/proj1': true});
    expect(screen.getAllByRole('table')).toHaveLength(2);

    rerender(
      <NestedRecordTable
        records={people}
        columns={['name']}
        nested={spec}
        expanded={{rec1: true, 'rec1/projects/proj1': true}}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(screen.getAllByRole('table')).toHaveLength(3);
  });

  test('child expansion survives collapsing and reopening the parent', async () => {
    const user = userEvent.setup();
    render(<NestedRecordTable records={people} columns={['name']} nested={spec} />);

    const root = screen.getByRole('button', {name: 'Expand row'});
    await user.click(root);
    await user.click(within(screen.getAllByRole('table')[1]!).getByRole('button', {name: 'Expand row'}));
    expect(screen.getAllByRole('table')).toHaveLength(3);

    await user.click(root);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    await user.click(root);
    expect(screen.getAllByRole('table')).toHaveLength(3);
  });

  test('applies per-level row keys, classes and columns', () => {
    render(
      <NestedRecordTable
        records={people}
        columns={['name']}
        defaultExpanded
        nested={{
          projects: {
            columns: [{id: 'label', header: 'Label', accessor: project => `${project.name}!`}],
            getRowKey: project => `p-${project.id}`,
            rowClassName: project => (project.fields.status?.name === 'Active' ? 'is-active' : undefined),
          },
        }}
      />,
    );

    const projects = screen.getAllByRole('table')[1]!;
    expect(within(projects).getByRole('columnheader', {name: 'Label'})).toBeDefined();
    expect(within(projects).getByText('Website!').closest('tr')).toHaveClass('is-active');
    expect(within(projects).getByText('App!').closest('tr')).not.toHaveClass('is-active');
  });

  test('has no accessibility violations fully expanded', async () => {
    const {container} = render(<NestedRecordTable records={people} columns={['name']} nested={spec} defaultExpanded />);
    expect((await axe.run(container, axeOptions)).violations).toEqual([]);
  });
});

// Only included links (arrays of rows carrying `fields`) may be nested.
const validSpec: NestedSpec<PersonRecord> = {projects: {nested: {tasks: {columns: ['title']}}}};
// @ts-expect-error "teams" is a plain `{id, name}[]` link, not an included one
const stubLink: NestedSpec<PersonRecord> = {teams: {}};
// @ts-expect-error "age" is not an array of records
const scalar: NestedSpec<PersonRecord> = {age: {}};
// @ts-expect-error "missing" is not a column of the Tasks level
const wrongColumn: NestedSpec<PersonRecord> = {projects: {nested: {tasks: {columns: ['missing']}}}};
// @ts-expect-error "project" on a task is a stub link, so no third level exists here
const tooDeep: NestedSpec<PersonRecord> = {projects: {nested: {tasks: {nested: {project: {}}}}}};
// Untyped rows accept any key.
const loose: NestedSpec<{id: string; fields: {[key: string]: unknown}}> = {anything: {columns: ['whatever']}};
void [validSpec, stubLink, scalar, wrongColumn, tooDeep, loose];
