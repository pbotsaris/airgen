import * as React from 'react';

import {
  RecordTable,
  humanizeFieldKey,
  type RecordTableColumn,
  type RecordTableExpandedMap,
  type RecordTableFieldKey,
  type RecordTableProps,
} from './Table.js';
import {Text} from './Text.js';
import {useControllableState} from '../utils.js';

type Structural = {id: string; fields: object};

/** The untyped row shape every level is rendered through at runtime. */
type LooseRecord = {id: string; fields: {[fieldKey: string]: unknown}};

/**
 * The rows an included link cell holds (`Array<IncludedRecord>` after
 * `useRecords(key, {include})`). Any other cell yields `never`: a link that
 * was not included is `{id, name}[]` without `fields`, and scalars, selects
 * and lookups are not arrays of rows. An untyped cell (`unknown`) yields the
 * loose row so rows without generated types still work.
 */
type IncludedRow<Cell> = unknown extends Cell
  ? LooseRecord
  : NonNullable<Cell> extends ReadonlyArray<infer Row extends Structural>
    ? Row
    : never;

/** Field keys of `TRecord` that hold included links. */
export type NestedRecordKey<TRecord extends Structural> = {
  [K in keyof TRecord['fields'] & string]: [IncludedRow<TRecord['fields'][K]>] extends [never] ? never : K;
}[keyof TRecord['fields'] & string];

/** The linked row type behind a nested key. */
export type NestedRecordOf<TRecord extends Structural, K extends NestedRecordKey<TRecord>> = IncludedRow<
  TRecord['fields'][K]
>;

/** How one included link renders under its parent row. */
export interface NestedLevel<TRecord extends Structural> {
  /** Columns of the sub-table; inferred from the linked rows when omitted. */
  columns?: ReadonlyArray<RecordTableFieldKey<TRecord> | RecordTableColumn<TRecord>>;
  /** Links of the linked table to render one level deeper. */
  nested?: NestedSpec<TRecord>;
  /** Heading above the sub-table. @defaultValue humanized field key */
  title?: React.ReactNode;
  /** When set, rows with no linked records stay expandable and show this instead of a table. */
  emptyMessage?: React.ReactNode;
  /** Stable row key within this level; defaults to the record id. */
  getRowKey?: (record: TRecord, index: number) => React.Key;
  /** Classes on each row of this level. */
  rowClassName?: string | ((record: TRecord, index: number) => string | undefined);
  /** Enable column resizing on this level's table. @defaultValue false */
  resizable?: boolean;
  /** Show vertical dividers on this level's table. @defaultValue false */
  columnLines?: boolean;
}

/**
 * One entry per included link to render; keys autocomplete from the hydrated
 * record type. A record with no included links accepts no keys at all (a
 * bare `{}` would let any key through unchecked).
 */
export type NestedSpec<TRecord extends Structural> = [NestedRecordKey<TRecord>] extends [never]
  ? {readonly [fieldKey: string]: never}
  : {readonly [K in NestedRecordKey<TRecord>]?: NestedLevel<NestedRecordOf<TRecord, K>>};

export interface NestedRecordTableProps<TRecord extends Structural> extends Omit<
  RecordTableProps<TRecord>,
  'renderExpanded' | 'canExpand' | 'defaultExpanded' | 'expanded' | 'onExpandedChange'
> {
  /** Included links to render as sub-tables under each row, recursively. */
  nested: NestedSpec<TRecord>;
  /** `true` opens every level; a number opens the levels shallower than it. @defaultValue false */
  defaultExpanded?: boolean | number;
  /**
   * Overrides keyed by row path: `rec1`, `rec1/projects/proj1`,
   * `rec1/projects/proj1/tasks/task1`. Controlled when supplied.
   */
  expanded?: RecordTableExpandedMap;
  /** Receives the full override map after every toggle at any level. */
  onExpandedChange?: (expanded: RecordTableExpandedMap) => void;
}

const NO_OVERRIDES: RecordTableExpandedMap = {};

/**
 * `RecordTable` for rows hydrated with `useRecords(key, {include})`: each row
 * expands into one sub-table per included link, and those sub-tables nest in
 * turn. Every level is its own table with its own columns. Keys of `nested`
 * are the links the record type actually carries hydrated, so an un-included
 * link (`{id, name}[]`) or a deeper level than `include` reached is a compile
 * error. Expansion state is kept per row path, so collapsing a parent and
 * reopening it restores its children.
 *
 * @example
 * ```tsx
 * const people = useRecords('People', {include: {projects: {tasks: true}}});
 * <NestedRecordTable
 *   records={people}
 *   columns={['name', 'email']}
 *   nested={{projects: {columns: ['name', 'status'], nested: {tasks: {columns: ['title', 'done']}}}}}
 * />;
 * ```
 */
export function NestedRecordTable<TRecord extends Structural>({
  nested,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  ...props
}: NestedRecordTableProps<TRecord>) {
  const [expanded, setExpanded] = useControllableState<RecordTableExpandedMap>({
    value: expandedProp,
    defaultValue: NO_OVERRIDES,
    onChange: onExpandedChange,
  });

  return (
    <NestedLevelTable
      {...(props as unknown as LevelBaseProps)}
      nested={nested as LooseSpec}
      depth={0}
      path=""
      expanded={expanded}
      setExpanded={setExpanded}
      defaultExpanded={defaultExpanded}
    />
  );
}

type LooseSpec = {readonly [fieldKey: string]: NestedLevel<LooseRecord> | undefined};

type LevelBaseProps = Omit<
  RecordTableProps<LooseRecord>,
  'renderExpanded' | 'canExpand' | 'defaultExpanded' | 'expanded' | 'onExpandedChange'
>;

interface LevelTableProps extends LevelBaseProps {
  nested?: LooseSpec;
  depth: number;
  path: string;
  expanded: RecordTableExpandedMap;
  setExpanded: (expanded: RecordTableExpandedMap) => void;
  defaultExpanded: boolean | number;
}

function linkedRows(record: LooseRecord, fieldKey: string): ReadonlyArray<LooseRecord> {
  const cell = record.fields[fieldKey];
  return Array.isArray(cell) ? (cell as ReadonlyArray<LooseRecord>) : [];
}

function NestedLevelTable({
  nested,
  depth,
  path,
  expanded,
  setExpanded,
  defaultExpanded,
  getRowKey,
  ...props
}: LevelTableProps) {
  const spec = nested ?? {};
  const keys = Object.keys(spec).filter(key => spec[key] !== undefined);
  const rowKey = (record: LooseRecord, index: number) => (getRowKey ? getRowKey(record, index) : record.id);
  const pathOf = (record: LooseRecord, index: number) =>
    path === '' ? String(rowKey(record, index)) : `${path}/${rowKey(record, index)}`;

  if (keys.length === 0) return <RecordTable {...props} getRowKey={rowKey} />;

  return (
    <RecordTable
      {...props}
      getRowKey={pathOf}
      canExpand={record => keys.some(key => linkedRows(record, key).length > 0 || spec[key]?.emptyMessage != null)}
      defaultExpanded={typeof defaultExpanded === 'number' ? depth < defaultExpanded : defaultExpanded}
      expanded={expanded}
      onExpandedChange={setExpanded}
      renderExpanded={({record, rowIndex}) => (
        <div className="ag-flex ag-flex-col ag-gap-3 ag-py-2 ag-pr-3" style={{paddingLeft: 40}}>
          {keys.map(key => {
            const level = spec[key]!;
            const rows = linkedRows(record, key);

            return (
              <section key={key}>
                <Text as="h4" variant="muted" bold className="ag-mb-1">
                  {level.title ?? humanizeFieldKey(key)} <span className="ag-font-normal">({rows.length})</span>
                </Text>
                {rows.length === 0 && level.emptyMessage != null ? (
                  <Text variant="muted">{level.emptyMessage}</Text>
                ) : (
                  <NestedLevelTable
                    records={rows}
                    columns={level.columns}
                    nested={level.nested as LooseSpec | undefined}
                    getRowKey={level.getRowKey}
                    rowClassName={level.rowClassName}
                    resizable={level.resizable}
                    columnLines={level.columnLines}
                    depth={depth + 1}
                    path={`${pathOf(record, rowIndex)}/${key}`}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    defaultExpanded={defaultExpanded}
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    />
  );
}
