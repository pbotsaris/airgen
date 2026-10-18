import * as React from 'react';
import {describe, expect, test, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';

import {
  RecordCellValue,
  RecordTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type RecordTableColumn,
} from '../src/components/Table';

describe('Table primitives', () => {
  test('render semantic native table markup', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getByRole('columnheader', {name: 'Name'})).toBeDefined();
    expect(screen.getByRole('cell', {name: 'Alpha'})).toBeDefined();
    expect(screen.queryByRole('separator')).toBeNull();
  });

  function renderResizable() {
    const ref = React.createRef<HTMLTableElement>();
    const headRef = React.createRef<HTMLTableCellElement>();
    const onClick = vi.fn();
    const result = render(
      <Table resizable ref={ref}>
        <TableHeader>
          <TableRow>
            <TableHead ref={headRef} minWidth={100} maxWidth={300} onClick={onClick}>
              Name
            </TableHead>
            <TableHead resizable={false}>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const header of screen.getAllByRole('columnheader')) {
      vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({width: 200} as DOMRect);
    }
    const handle = screen.getByRole('separator', {name: 'Resize Name'});
    // jsdom has no pointer capture; browsers use it to continue drags outside the handle.
    const setPointerCapture = vi.fn();
    Object.defineProperty(handle, 'setPointerCapture', {value: setPointerCapture});
    return {...result, ref, headRef, onClick, handle, setPointerCapture};
  }

  test('resizes with the keyboard, preserves adjacent widths and forwards refs', async () => {
    const user = userEvent.setup();
    const {ref, headRef, handle, onClick} = renderResizable();
    expect(ref.current).toBe(screen.getByRole('table'));
    expect(headRef.current).toBe(screen.getAllByRole('columnheader')[0]);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    await user.tab();
    expect(handle).toHaveFocus();
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    await user.keyboard('{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '210');
    expect(ref.current).toHaveStyle({tableLayout: 'fixed', width: '410px'});
    expect(ref.current!.querySelectorAll('col')[1]).toHaveStyle({width: '200px'});
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(handle).toHaveAttribute('aria-valuenow', '160');
    await user.keyboard('{Home}{ArrowLeft}');
    expect(handle).toHaveAttribute('aria-valuenow', '100');
    await user.keyboard('{End}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    await user.click(handle);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('captures pointer drags, clamps widths and stops resizing on cancellation', () => {
    const {handle, setPointerCapture} = renderResizable();
    const pointer = (type: string, clientX: number, pointerId = 1) => {
      const event = new MouseEvent(type, {bubbles: true, button: 0, clientX});
      Object.defineProperty(event, 'pointerId', {value: pointerId});
      fireEvent(handle, event);
    };
    pointer('pointerdown', 200);
    expect(setPointerCapture).toHaveBeenCalledWith(1);
    pointer('pointermove', 230, 2);
    expect(screen.getByRole('table').querySelector('col')).toBeNull();
    pointer('pointermove', 240);
    expect(handle).toHaveAttribute('aria-valuenow', '240');
    pointer('pointermove', 500);
    expect(handle).toHaveAttribute('aria-valuenow', '300');
    pointer('pointermove', 0);
    expect(handle).toHaveAttribute('aria-valuenow', '100');
    pointer('pointercancel', 0);
    pointer('pointermove', 250);
    expect(handle).toHaveAttribute('aria-valuenow', '100');
    pointer('pointerdown', 100);
    pointer('pointermove', 150);
    expect(handle).toHaveAttribute('aria-valuenow', '150');
    pointer('pointerup', 150);
    pointer('pointermove', 180);
    expect(handle).toHaveAttribute('aria-valuenow', '150');
  });

  test('resizable tables have no accessibility violations', async () => {
    const {container, handle} = renderResizable();
    fireEvent.focus(handle);
    const result = await axe.run(container, {rules: {'color-contrast': {enabled: false}}});
    expect(result.violations).toEqual([]);
  });
});

interface ProjectFields {
  name?: string;
  status?: {id: string; name: string; color?: string};
  tags?: Array<{id: string; name: string; color?: string}>;
  taskCount?: number;
}

interface ProjectRecord {
  id: string;
  fields: ProjectFields;
  raw: {native: true};
}

const records: ProjectRecord[] = [
  {
    id: 'rec1',
    fields: {
      name: 'Website',
      status: {id: 'sel1', name: 'Active', color: 'greenBright'},
      tags: [
        {id: 'sel2', name: 'Design', color: 'purpleBright'},
        {id: 'sel3', name: 'Urgent', color: 'redBright'},
      ],
      taskCount: 3,
    },
    raw: {native: true},
  },
];

const columns: Array<RecordTableColumn<ProjectRecord>> = [
  {id: 'name', header: 'Project'},
  {id: 'status', header: 'Status'},
  {id: 'tags', header: 'Tags'},
  {
    id: 'summary',
    header: 'Summary',
    accessor: record => record.fields.taskCount,
    cell: ({record, value}) => `${record.fields.name}: ${value} tasks`,
    align: 'right',
  },
];

describe('RecordTable', () => {
  test('supports column resize limits, labels and opt-outs', async () => {
    const user = userEvent.setup();
    render(
      <RecordTable
        records={records}
        resizable
        columns={[
          {id: 'name', header: <span>Project</span>, minWidth: 120, maxWidth: 360, resizeLabel: 'Resize project'},
          {id: 'status', resizable: false},
        ]}
      />,
    );
    const handle = screen.getByRole('separator', {name: 'Resize project'});
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    await user.tab();
    await user.keyboard('{End}');
    expect(handle).toHaveAttribute('aria-valuenow', '360');
    await user.keyboard('{Home}');
    expect(handle).toHaveAttribute('aria-valuenow', '120');
  });

  test('infers populated fields when columns are omitted', () => {
    render(<RecordTable records={records} />);

    expect(screen.getByRole('columnheader', {name: 'Name'})).toBeDefined();
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeDefined();
    expect(screen.getByRole('columnheader', {name: 'Task Count'})).toBeDefined();
    expect(screen.getByText('Website')).toBeDefined();
  });

  test('accepts typed field-key shorthand to limit visible columns', () => {
    render(<RecordTable records={records} columns={['name', 'status']} />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getByRole('columnheader', {name: 'Name'})).toBeDefined();
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeDefined();
    expect(screen.queryByText('Design')).toBeNull();
  });

  test('renders airgen useRecords shapes with Airtable-aware defaults', () => {
    render(<RecordTable records={records} columns={columns} caption="Projects in this base" />);

    const table = screen.getByRole('table', {name: 'Projects in this base'});
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByText('Website')).toBeDefined();
    expect(within(row).getByText('Active')).toBeDefined();
    expect(within(row).getByText('Design')).toBeDefined();
    expect(within(row).getByText('Urgent')).toBeDefined();
    expect(within(row).getByText('Website: 3 tasks')).toBeDefined();
  });

  test('renders configurable empty and loading states', () => {
    const empty = render(<RecordTable records={[]} columns={columns} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeDefined();

    empty.rerender(<RecordTable records={[]} columns={columns} loading loadingLabel="Fetching projects" />);
    expect(screen.getByRole('status', {name: 'Fetching projects'})).toBeDefined();
    expect(screen.getByText('Fetching projects')).toBeDefined();
  });
});

describe('RecordTable expandable rows', () => {
  const two: ProjectRecord[] = [records[0]!, {id: 'rec2', fields: {name: 'App', taskCount: 0}, raw: {native: true}}];
  const detail = ({record}: {record: ProjectRecord}) => <div>Details for {record.fields.name}</div>;

  test('prepends a toggle column and renders the detail row while expanded', async () => {
    const user = userEvent.setup();
    render(<RecordTable records={two} columns={['name', 'status']} renderExpanded={detail} />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('columnheader', {name: 'Expand'})).toBeDefined();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]!).getAllByRole('cell')).toHaveLength(3);
    expect(screen.queryByText('Details for Website')).toBeNull();

    const toggle = screen.getAllByRole('button', {name: 'Expand row'})[0]!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).not.toHaveAttribute('aria-controls');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Collapse row');
    const detailRow = screen.getByText('Details for Website').closest('tr')!;
    expect(detailRow.id).toBe(toggle.getAttribute('aria-controls'));
    expect(detailRow.querySelector('td')).toHaveAttribute('colspan', '3');
    expect(screen.queryByText('Details for App')).toBeNull();

    await user.click(toggle);
    expect(screen.queryByText('Details for Website')).toBeNull();
  });

  test('canExpand leaves an empty leading cell and defaultExpanded opens rows initially', () => {
    render(
      <RecordTable
        records={two}
        columns={['name']}
        renderExpanded={detail}
        canExpand={record => record.fields.name !== 'App'}
        defaultExpanded={record => record.fields.name === 'Website'}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Details for Website')).toBeDefined();
    const appRow = screen.getByText('App').closest('tr')!;
    expect(within(appRow).getAllByRole('cell')).toHaveLength(2);
    expect(within(appRow).getAllByRole('cell')[0]).toBeEmptyDOMElement();
  });

  test('controlled expanded map wins and only reports the next map', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    render(
      <RecordTable
        records={two}
        columns={['name']}
        renderExpanded={detail}
        defaultExpanded
        expanded={{rec1: false}}
        onExpandedChange={onExpandedChange}
      />,
    );

    expect(screen.queryByText('Details for Website')).toBeNull();
    expect(screen.getByText('Details for App')).toBeDefined();
    await user.click(screen.getByRole('button', {name: 'Expand row'}));
    expect(onExpandedChange).toHaveBeenCalledWith({rec1: true});
    expect(screen.queryByText('Details for Website')).toBeNull();
  });

  test('state rows span the toggle column and resizing skips it', async () => {
    const user = userEvent.setup();
    const {rerender} = render(<RecordTable records={[]} columns={['name', 'status']} renderExpanded={detail} />);
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '3');

    rerender(<RecordTable records={two} columns={['name', 'status']} renderExpanded={detail} resizable />);
    for (const header of screen.getAllByRole('columnheader')) {
      vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({width: 100} as DOMRect);
    }
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    await user.tab();
    expect(screen.getByRole('separator', {name: 'Resize Name'})).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const cols = screen.getByRole('table').querySelectorAll('col');
    expect(cols).toHaveLength(3);
    expect(cols[0]).toHaveStyle({width: '100px'});
    expect(cols[1]).toHaveStyle({width: '110px'});
  });

  test('rowgroup headers never get a resize handle', () => {
    render(
      <Table resizable>
        <TableBody>
          <TableRow>
            <TableHead scope="rowgroup">Group</TableHead>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.queryByRole('separator')).toBeNull();
  });

  test('expandable tables have no accessibility violations open or closed', async () => {
    const {container, rerender} = render(<RecordTable records={two} columns={['name']} renderExpanded={detail} />);
    expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);
    rerender(<RecordTable records={two} columns={['name']} renderExpanded={detail} defaultExpanded />);
    expect((await axe.run(container, {rules: {'color-contrast': {enabled: false}}})).violations).toEqual([]);
  });
});

// A field column must use a key generated by airgen; arbitrary ids are only
// valid for derived/display columns that provide an accessor.
// @ts-expect-error "missingField" is not a ProjectFields key
const invalidColumn: RecordTableColumn<ProjectRecord> = {id: 'missingField', header: 'Missing'};
void invalidColumn;

describe('RecordCellValue', () => {
  test('unwraps lookup values and formats booleans and empty values', () => {
    const {rerender} = render(<RecordCellValue value={{linkedRecordId: 'rec1', value: 'Lookup text'}} />);
    expect(screen.getByText('Lookup text')).toBeDefined();

    rerender(<RecordCellValue value={true} />);
    expect(screen.getByText('Yes')).toBeDefined();

    rerender(<RecordCellValue value={null} empty="Not set" />);
    expect(screen.getByText('Not set')).toBeDefined();
  });
});
