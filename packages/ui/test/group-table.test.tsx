import * as React from 'react';
import {describe, expect, test, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';

import {GroupTable, nestGroups, type GroupContext, type RecordGroup} from '../src/components/GroupTable';

interface ProjectRecord {
  id: string;
  name: string;
  fields: {name?: string; status?: {id: string; name: string}; owner?: {id: string; name: string}; hours?: number};
  raw: unknown;
}

const project = (
  id: string,
  name: string,
  status: string | null,
  owner: string | null,
  hours: number,
): ProjectRecord => ({
  id,
  name,
  fields: {
    name,
    hours,
    ...(status === null ? {} : {status: {id: `s-${status}`, name: status}}),
    ...(owner === null ? {} : {owner: {id: `o-${owner}`, name: owner}}),
  },
  raw: null,
});

const website = project('p1', 'Website', 'Active', 'Ana', 4);
const api = project('p2', 'API', 'Active', 'Ana', 8);
const store = project('p3', 'Store', 'Active', 'Bruno', 2);
const legacy = project('p4', 'Legacy', 'Done', null, 20);

// What groupRecords(projects, {fields: ['status', 'owner']}) yields: flat, cartesian, first-seen.
const twoLevel: RecordGroup<ProjectRecord>[] = [
  {key: '["Active","Ana"]', values: ['Active', 'Ana'], records: [website, api]},
  {key: '["Active","Bruno"]', values: ['Active', 'Bruno'], records: [store]},
  {key: '["Done",null]', values: ['Done', null], records: [legacy]},
];
const oneLevel: RecordGroup<ProjectRecord>[] = [
  {key: '["Active"]', values: ['Active'], records: [website, api, store]},
  {key: '["Done"]', values: ['Done'], records: [legacy]},
];

const hours = (records: ReadonlyArray<ProjectRecord>) => ({
  hours: records.reduce((total, record) => total + (record.fields.hours ?? 0), 0),
});
const axeOptions = {rules: {'color-contrast': {enabled: false}}};

describe('nestGroups', () => {
  test('folds the cartesian list into a tree in first-seen order', () => {
    const tree = nestGroups(twoLevel);
    expect(tree.map(node => [node.key, node.depth, node.value, node.records.length])).toEqual([
      ['["Active"]', 0, 'Active', 3],
      ['["Done"]', 0, 'Done', 1],
    ]);
    expect(tree[0]!.children.map(node => [node.key, node.depth, node.value, node.records.length])).toEqual([
      ['["Active","Ana"]', 1, 'Ana', 2],
      ['["Active","Bruno"]', 1, 'Bruno', 1],
    ]);
    expect(tree[1]!.children[0]!.value).toBeNull();
    expect(tree[0]!.children[0]!.records).toEqual([website, api]);
  });

  test('counts a record once in a parent when it sits in two sibling leaves', () => {
    const tree = nestGroups([
      {key: '["A","x"]', values: ['A', 'x'], records: [website, api]},
      {key: '["A","y"]', values: ['A', 'y'], records: [website]},
    ]);
    expect(tree[0]!.records).toEqual([website, api]);
    expect(tree[0]!.children.map(node => node.records.length)).toEqual([2, 1]);
  });

  test('single-field groups are leaves and an empty values array is one leaf', () => {
    expect(nestGroups(oneLevel).every(node => node.children.length === 0)).toBe(true);
    const [only] = nestGroups([{key: 'all', values: [], records: [website]}]);
    expect(only).toMatchObject({key: 'all', depth: 0, value: null, children: []});
  });
});

describe('GroupTable', () => {
  test('renders nested group rows with labels, counts and records', () => {
    render(
      <GroupTable
        groups={twoLevel}
        columns={['name', 'status', 'owner']}
        groupLabels={['Status', 'Owner']}
        emptyGroupLabel="Unowned"
      />,
    );

    const groupRows = screen.getAllByRole('rowheader');
    expect(groupRows.map(cell => cell.textContent)).toEqual([
      'Status: Active(3)',
      'Owner: Ana(2)',
      'Owner: Bruno(1)',
      'Status: Done(1)',
      'Owner: Unowned(1)',
    ]);
    expect(screen.getByText('Website')).toBeDefined();
    expect(screen.getByText('Legacy')).toBeDefined();
    expect(screen.getAllByRole('button', {name: /Collapse/})).toHaveLength(5);
    expect(screen.getByRole('button', {name: 'Collapse Unowned'})).toBeDefined();
  });

  test('collapsing a leaf hides its records and collapsing a parent hides its children', async () => {
    const user = userEvent.setup();
    render(<GroupTable groups={twoLevel} columns={['name']} />);

    await user.click(screen.getByRole('button', {name: 'Collapse Ana'}));
    expect(screen.queryByText('Website')).toBeNull();
    expect(screen.getByText('Store')).toBeDefined();
    expect(screen.getByRole('button', {name: 'Expand Ana'})).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', {name: 'Collapse Active'}));
    expect(screen.queryByText('Store')).toBeNull();
    expect(screen.queryByRole('button', {name: 'Expand Ana'})).toBeNull();
    expect(screen.getByText('Legacy')).toBeDefined();

    await user.click(screen.getByRole('button', {name: 'Expand Active'}));
    expect(screen.getByRole('button', {name: 'Expand Ana'})).toBeDefined();
    expect(screen.getByText('Store')).toBeDefined();
  });

  test('collapsible={false} renders no toggles', () => {
    render(<GroupTable groups={oneLevel} columns={['name']} collapsible={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });

  test('header placement keeps summaries in the group row while collapsed', async () => {
    const user = userEvent.setup();
    render(<GroupTable groups={twoLevel} columns={['name', 'hours']} summary={hours} />);

    const activeRow = screen.getByRole('rowheader', {name: /Active/}).closest('tr')!;
    expect(within(activeRow).getAllByRole('cell')).toHaveLength(1);
    expect(within(activeRow).getByRole('cell')).toHaveTextContent('14');
    const anaRow = screen.getByRole('rowheader', {name: /Ana/}).closest('tr')!;
    expect(within(anaRow).getByRole('cell')).toHaveTextContent('12');

    await user.click(screen.getByRole('button', {name: 'Collapse Active'}));
    expect(within(activeRow).getByRole('cell')).toHaveTextContent('14');
    expect(screen.queryByText('12')).toBeNull();
  });

  test('footer placement adds totals rows after records and children', async () => {
    const user = userEvent.setup();
    render(<GroupTable groups={twoLevel} columns={['name', 'hours']} summary={hours} summaryPlacement="footer" />);

    const headers = screen.getAllByRole('rowheader');
    for (const header of headers) expect(header).toHaveAttribute('colspan', '2');
    const rows = screen.getAllByRole('row').map(row => row.textContent);
    const indexOf = (text: string) => rows.findIndex(row => row?.includes(text));
    // Ana's records, then Ana's total; Bruno's records, then Bruno's total; then Active's total.
    expect(indexOf('12')).toBeGreaterThan(indexOf('API'));
    expect(indexOf('12')).toBeLessThan(indexOf('Bruno'));
    expect(rows[indexOf('14')]).toBe('14');
    expect(indexOf('14')).toBeGreaterThan(indexOf('Store'));
    expect(indexOf('14')).toBeLessThan(indexOf('Done'));

    await user.click(screen.getByRole('button', {name: 'Collapse Active'}));
    expect(screen.queryByText('14')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
  });

  test('defaultExpanded as a depth and controlled expansion keyed by node key', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const {rerender} = render(<GroupTable groups={twoLevel} columns={['name']} defaultExpanded={1} />);
    expect(screen.getByRole('button', {name: 'Expand Ana'})).toBeDefined();
    expect(screen.queryByText('Website')).toBeNull();

    rerender(
      <GroupTable
        groups={twoLevel}
        columns={['name']}
        expanded={{'["Active"]': false}}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(screen.queryByRole('button', {name: /Ana/})).toBeNull();
    await user.click(screen.getByRole('button', {name: 'Expand Active'}));
    expect(onExpandedChange).toHaveBeenCalledWith({'["Active"]': true});
    expect(screen.queryByRole('button', {name: /Ana/})).toBeNull();
  });

  test('summary and renderGroupLabel receive the group context', () => {
    const summary = vi.fn((records: ReadonlyArray<ProjectRecord>, _context: GroupContext<ProjectRecord>) => ({
      name: `${records.length} projects`,
    }));
    render(
      <GroupTable
        groups={twoLevel}
        columns={['name']}
        summary={summary}
        showCount={false}
        renderGroupLabel={context => `${context.depth}:${context.value ?? 'none'}:${context.leaf ? 'leaf' : 'parent'}`}
      />,
    );

    expect(screen.getByRole('rowheader', {name: /0:Active:parent/})).toHaveTextContent('3 projects');
    expect(screen.getByRole('rowheader', {name: /1:none:leaf/})).toHaveTextContent('1 projects');
    const activeCall = summary.mock.calls.find(([, context]) => context.key === '["Active"]')!;
    expect(activeCall[1]).toMatchObject({depth: 0, leaf: false, count: 3, expanded: true, values: ['Active']});
    expect(activeCall[0].map(record => record.id)).toEqual(['p1', 'p2', 'p3']);
  });

  test('formatSummary renders numeric summary values and leaves the rest alone', () => {
    const formatSummary = vi.fn((value: number, columnId: string) => `${columnId}=${value} h`);
    render(
      <GroupTable
        groups={twoLevel}
        columns={['name', 'hours']}
        summary={records => ({...hours(records), name: 'all', status: null})}
        formatSummary={formatSummary}
      />,
    );

    const activeRow = screen.getByRole('rowheader', {name: /Active/}).closest('tr')!;
    expect(within(activeRow).getByRole('cell')).toHaveTextContent('hours=14 h');
    expect(within(activeRow).getByRole('rowheader')).toHaveTextContent('all');
    expect(formatSummary.mock.calls.every(([, columnId]) => columnId === 'hours')).toBe(true);
  });

  test('infers columns across groups and renders loading and empty states', () => {
    const {rerender} = render(<GroupTable groups={twoLevel} />);
    expect(screen.getByRole('columnheader', {name: 'Owner'})).toBeDefined();
    expect(screen.getByRole('columnheader', {name: 'Hours'})).toBeDefined();

    rerender(
      <GroupTable
        groups={[] as RecordGroup<ProjectRecord>[]}
        columns={['name', 'hours']}
        emptyMessage="Nothing grouped"
      />,
    );
    expect(screen.getByText('Nothing grouped').closest('td')).toHaveAttribute('colspan', '2');

    rerender(<GroupTable groups={twoLevel} columns={['name']} loading loadingLabel="Grouping" />);
    expect(screen.getByRole('status', {name: 'Grouping'})).toBeDefined();
    expect(screen.queryByText('Website')).toBeNull();
  });

  test('resizable tables only put handles in the column header row', () => {
    render(<GroupTable groups={twoLevel} columns={['name', 'hours']} resizable />);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  test('has no accessibility violations in either placement', async () => {
    const {container, rerender} = render(
      <GroupTable groups={twoLevel} columns={['name', 'hours']} summary={hours} caption="Projects" />,
    );
    expect((await axe.run(container, axeOptions)).violations).toEqual([]);
    rerender(<GroupTable groups={twoLevel} columns={['name', 'hours']} summary={hours} summaryPlacement="footer" />);
    expect((await axe.run(container, axeOptions)).violations).toEqual([]);
  });
});
