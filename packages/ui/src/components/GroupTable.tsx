import * as React from 'react';

import {CaretButton} from './CaretButton.js';
import {Spinner} from './Spinner.js';
import {
  RecordRow,
  Table,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableStateRow,
  alignmentClass,
  resolveColumns,
  type RecordTableExpandedMap,
  type RecordTableProps,
} from './Table.js';
import {Text} from './Text.js';
import {cx, useControllableState} from '../utils.js';

type Structural = {id: string; fields: object};

/** One group as airgen's `groupRecords` returns it (structurally `QueryGroup`). */
export interface RecordGroup<TRecord> {
  /** Stable key, `JSON.stringify(values)` from `groupRecords`. */
  readonly key: string;
  /** One value per grouped field, in grouping order; `null` for an empty cell. */
  readonly values: ReadonlyArray<string | null>;
  readonly records: ReadonlyArray<TRecord>;
}

/** What a group label or summary renderer receives. */
export interface GroupContext<TRecord> {
  /** Node key: the group's own key for a leaf, the JSON of its values prefix for a parent. */
  key: string;
  /** Values down to this level. */
  values: ReadonlyArray<string | null>;
  /** This level's value. */
  value: string | null;
  /** Zero-based grouping level. */
  depth: number;
  /** Whether records render directly under this group. */
  leaf: boolean;
  /** Leaf: the group's records. Parent: the distinct-by-id union of its leaves. */
  records: ReadonlyArray<TRecord>;
  count: number;
  expanded: boolean;
}

/** Summary cells keyed by column id (field key or accessor id). */
export type GroupSummary = Readonly<Record<string, React.ReactNode>>;

/** The leading column that holds group labels and toggles. */
export interface GroupColumnOptions {
  /** Column header. @defaultValue a visually hidden "Group" */
  header?: React.ReactNode;
  /** Column width in pixels (number) or a CSS width string. */
  width?: number | string;
  /** Disable resizing for this column when the table is resizable. @defaultValue true */
  resizable?: boolean;
  /** Minimum resized width in pixels. @defaultValue 80 */
  minWidth?: number;
  /** Maximum resized width in pixels. */
  maxWidth?: number;
  /** Accessible resize handle name. */
  resizeLabel?: string;
  headerClassName?: string;
  /** Classes on the group, record and totals cells of this column. */
  cellClassName?: string;
}

export interface GroupTableProps<TRecord extends Structural> extends Omit<
  RecordTableProps<TRecord>,
  'records' | 'renderExpanded' | 'canExpand' | 'defaultExpanded' | 'expanded' | 'onExpandedChange'
> {
  /** Output of `groupRecords`; several grouped fields nest, one level per field. */
  groups: ReadonlyArray<RecordGroup<TRecord>>;
  /** One label per level: "Status" over (or before) each status value. */
  groupLabels?: ReadonlyArray<React.ReactNode>;
  /**
   * `above` stacks the level's label as a small caption over the value;
   * `inline` prefixes it, as in "Status: Done". @defaultValue 'above'
   */
  groupLabelPlacement?: 'above' | 'inline';
  /** Label for a `null` value. @defaultValue '(empty)' */
  emptyGroupLabel?: React.ReactNode;
  /** Replaces the default label (caption and value); the caret, count and summary stay. */
  renderGroupLabel?: (context: GroupContext<TRecord>) => React.ReactNode;
  /** Show the record count after the label. @defaultValue true */
  showCount?: boolean;
  /**
   * Per-column aggregations for a group, e.g. `{hours: total}`. Called for
   * every level. airgen's `aggregate` returns this shape directly when its
   * names are column ids: `records => aggregate(records, {hours: {field: 'hours', op: 'sum'}})`.
   */
  summary?: (records: ReadonlyArray<TRecord>, context: GroupContext<TRecord>) => GroupSummary;
  /** Renders numeric summary values, e.g. as currency. Other values render as given. */
  formatSummary?: (value: number, columnId: string, context: GroupContext<TRecord>) => React.ReactNode;
  /**
   * `header` keeps summaries in the group row, visible while collapsed;
   * `footer` adds a totals row after the group's records; `auto` shows the
   * summary in the group row while collapsed and moves it to a totals row
   * while expanded. A leaf with `showRecords={false}` has nothing to open,
   * so its summary always stays in the group row. @defaultValue 'header'
   */
  summaryPlacement?: 'header' | 'footer' | 'auto';
  /** Leading text of a totals row's label cell (group column only). @defaultValue 'Total' */
  totalLabel?: React.ReactNode;
  /**
   * Render records under leaf groups. `false` shows group rows and their
   * summaries only, and implies `groupColumn`. @defaultValue true
   */
  showRecords?: boolean;
  /**
   * Adds a leading column holding the group labels and toggles, so data
   * columns carry only values and summaries. Implied by `showRecords={false}`.
   */
  groupColumn?: GroupColumnOptions;
  /** Classes on group rows, or a function of the group context; appended to the per-level style. */
  groupRowClassName?: string | ((context: GroupContext<TRecord>) => string | undefined);
  /** Show expand/collapse toggles on group rows. @defaultValue true */
  collapsible?: boolean;
  /** `true` opens every level; a number opens the levels shallower than it. @defaultValue true */
  defaultExpanded?: boolean | number;
  /** Overrides keyed by node key. Controlled when supplied. */
  expanded?: RecordTableExpandedMap;
  /** Receives the full override map after every toggle. */
  onExpandedChange?: (expanded: RecordTableExpandedMap) => void;
}

/** @internal A node of the group tree `nestGroups` builds. */
export interface GroupNode<TRecord> {
  key: string;
  depth: number;
  values: ReadonlyArray<string | null>;
  value: string | null;
  children: GroupNode<TRecord>[];
  /** Distinct by id across the node's leaves. */
  records: TRecord[];
}

/**
 * @internal Folds `groupRecords`' flat cartesian list into a tree by values
 * prefix, in first-seen order. Leaf keys equal the group keys; a parent's key
 * is the JSON of its values prefix. A record in two sibling leaves counts once
 * in their parent.
 */
export function nestGroups<TRecord extends {id: string}>(
  groups: ReadonlyArray<RecordGroup<TRecord>>,
): GroupNode<TRecord>[] {
  const roots: GroupNode<TRecord>[] = [];
  const nodes = new Map<string, {node: GroupNode<TRecord>; ids: Set<string>}>();

  for (const group of groups) {
    const levels = Math.max(group.values.length, 1);
    let parent: GroupNode<TRecord> | null = null;

    for (let depth = 0; depth < levels; depth++) {
      const values = group.values.slice(0, depth + 1);
      const key = depth === levels - 1 ? group.key : JSON.stringify(values);
      let entry = nodes.get(key);
      if (!entry) {
        const node: GroupNode<TRecord> = {key, depth, values, value: values[depth] ?? null, children: [], records: []};
        entry = {node, ids: new Set()};
        nodes.set(key, entry);
        (parent ? parent.children : roots).push(node);
      }
      for (const record of group.records) {
        if (!entry.ids.has(record.id)) {
          entry.ids.add(record.id);
          entry.node.records.push(record);
        }
      }
      parent = entry.node;
    }
  }

  return roots;
}

const NO_OVERRIDES: RecordTableExpandedMap = {};
const NO_GROUP_COLUMN: GroupColumnOptions = {};

/**
 * Group row style per level: the top level gets the darkest background and a
 * stronger top border (collapsed with the previous row's bottom border), each
 * deeper level a lighter one. Levels past the last entry reuse it.
 */
const GROUP_ROW_BY_DEPTH = [
  'ag-border-t-2 ag-border-t-neutral-300 ag-bg-neutral-100 hover:ag-bg-neutral-100 dark:ag-border-t-neutral-600 dark:ag-bg-neutral-800 dark:hover:ag-bg-neutral-800',
  'ag-bg-neutral-50 hover:ag-bg-neutral-50 dark:ag-bg-neutral-800/60 dark:hover:ag-bg-neutral-800/60',
  'ag-bg-neutral-50/50 hover:ag-bg-neutral-50/50 dark:ag-bg-neutral-800/30 dark:hover:ag-bg-neutral-800/30',
];
const SUMMARY_ROW_CLASS =
  'ag-bg-neutral-50/60 ag-font-medium hover:ag-bg-neutral-50/60 dark:ag-bg-neutral-800/30 dark:hover:ag-bg-neutral-800/30';
const CAPTION_CLASS =
  'ag-block ag-text-xs ag-font-medium ag-uppercase ag-tracking-wide ag-text-neutral-500 dark:ag-text-neutral-400';
const MUTED_CLASS = 'ag-font-normal ag-text-neutral-500 dark:ag-text-neutral-400';

/**
 * Renders `groupRecords` output as grouped rows: a header row per group, its
 * records under it, and one nested level per grouped field. Group rows carry
 * an optional per-column `summary` (count, sums, …) in the group row, in a
 * totals row after the records, or in the group row only while collapsed
 * (`summaryPlacement`). Every level collapses independently; levels are told
 * apart by indentation and a background that lightens with depth.
 *
 * For an aggregate-only view pass `showRecords={false}`: leaf groups show
 * their summary and no records. That (or an explicit `groupColumn`) moves
 * the labels into a leading column of their own, so every data column holds
 * only values and summaries; rename data columns with `{id, header}` entries.
 *
 * @example
 * ```tsx
 * const groups = groupRecords(projects, {fields: ['status', 'owner']});
 * <GroupTable
 *   groups={groups}
 *   columns={['name', 'status', 'owner', 'hours']}
 *   groupLabels={['Status', 'Owner']}
 *   summary={records => aggregate(records, {hours: {field: 'hours', op: 'sum'}})}
 *   formatSummary={hours => `${hours} h`}
 *   summaryPlacement="auto"
 * />;
 * ```
 *
 * @example Totals per group, no records
 * ```tsx
 * <GroupTable
 *   groups={groups}
 *   columns={[{id: 'hours', header: 'Total hours', align: 'right'}]}
 *   groupColumn={{header: 'Owner'}}
 *   showRecords={false}
 *   summary={records => aggregate(records, {hours: {field: 'hours', op: 'sum'}})}
 * />;
 * ```
 */
export function GroupTable<TRecord extends Structural>({
  groups,
  columns: columnsProp,
  caption,
  emptyMessage = 'No records.',
  loading = false,
  loadingLabel = 'Loading records',
  getRowKey = record => record.id,
  rowClassName,
  className,
  tableClassName,
  resizable,
  columnLines,
  groupLabels,
  groupLabelPlacement = 'above',
  emptyGroupLabel = '(empty)',
  renderGroupLabel,
  showCount = true,
  summary,
  formatSummary,
  summaryPlacement = 'header',
  totalLabel = 'Total',
  showRecords = true,
  groupColumn,
  groupRowClassName,
  collapsible = true,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
}: GroupTableProps<TRecord>) {
  const columns = resolveColumns(
    groups.flatMap(group => group.records),
    columnsProp,
  );
  const tree = nestGroups(groups);
  const [expanded, setExpanded] = useControllableState<RecordTableExpandedMap>({
    value: expandedProp,
    defaultValue: NO_OVERRIDES,
    onChange: onExpandedChange,
  });
  const hasGroupColumn = groupColumn !== undefined || !showRecords;
  const groupCell = groupColumn ?? NO_GROUP_COLUMN;
  const span = Math.max(columns.length + (hasGroupColumn ? 1 : 0), 1);
  const [first, ...rest] = columns;
  const indent = (depth: number) => ({paddingLeft: 12 + depth * 16});

  const isOpen = (node: GroupNode<TRecord>) =>
    expanded[node.key] ?? (typeof defaultExpanded === 'number' ? node.depth < defaultExpanded : defaultExpanded);

  const renderNode = (node: GroupNode<TRecord>): React.ReactNode[] => {
    const leaf = node.children.length === 0;
    // A leaf without records has nothing to open: no caret, summary in its row.
    const openable = !leaf || showRecords;
    const open = openable && isOpen(node);
    const context: GroupContext<TRecord> = {
      key: node.key,
      values: node.values,
      value: node.value,
      depth: node.depth,
      leaf,
      records: node.records,
      count: node.records.length,
      expanded: open,
    };
    const raw = summary ? summary(node.records, context) : undefined;
    const sums =
      raw && formatSummary
        ? Object.fromEntries(
            Object.entries(raw).map(([id, value]) => [
              id,
              typeof value === 'number' ? formatSummary(value, id, context) : value,
            ]),
          )
        : raw;
    const hasSummary = sums !== undefined && Object.keys(sums).length > 0;
    const placement = !openable
      ? 'header'
      : summaryPlacement === 'auto'
        ? open
          ? 'footer'
          : 'header'
        : summaryPlacement;
    const summaryInHeader = placement === 'header';
    const valueText = node.value ?? (typeof emptyGroupLabel === 'string' ? emptyGroupLabel : 'empty');
    const prefix = groupLabels?.[node.depth];
    const weight = node.depth === 0 ? 'ag-font-semibold' : 'ag-font-medium';
    const rowClass = cx(
      GROUP_ROW_BY_DEPTH[Math.min(node.depth, GROUP_ROW_BY_DEPTH.length - 1)],
      typeof groupRowClassName === 'function' ? groupRowClassName(context) : groupRowClassName,
    );
    const cellStyle = indent(node.depth);

    const label = (
      <span
        className={cx('ag-inline-flex ag-items-center ag-gap-1 ag-text-neutral-900 dark:ag-text-neutral-100', weight)}
      >
        {collapsible && openable && (
          <CaretButton
            size="icon-xs"
            variant="ghost"
            direction="right"
            open={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${valueText}`}
            onClick={() => setExpanded({...expanded, [node.key]: !open})}
          />
        )}
        {collapsible && !openable && <span aria-hidden className="ag-inline-block ag-w-5 ag-shrink-0" />}
        <span className={groupLabelPlacement === 'above' ? 'ag-flex ag-flex-col' : undefined}>
          {groupLabelPlacement === 'above' && !renderGroupLabel && prefix != null && (
            <span className={CAPTION_CLASS}>{prefix}</span>
          )}
          <span className="ag-inline-flex ag-items-center ag-gap-1">
            {renderGroupLabel ? (
              renderGroupLabel(context)
            ) : (
              <span>
                {groupLabelPlacement === 'inline' && prefix != null && (
                  <span className={cx('ag-text-sm', MUTED_CLASS)}>{prefix}: </span>
                )}
                {node.value ?? emptyGroupLabel}
              </span>
            )}
            {showCount && <span className={MUTED_CLASS}>({node.records.length})</span>}
          </span>
        </span>
      </span>
    );

    const headerRow = hasGroupColumn ? (
      <TableRow className={rowClass}>
        <TableHead
          scope="rowgroup"
          style={cellStyle}
          className={cx('ag-whitespace-nowrap ag-py-1.5', groupCell.cellClassName)}
        >
          {label}
        </TableHead>
        {columns.map(column => (
          <TableCell key={column.id} className={cx(weight, alignmentClass(column.align), column.cellClassName)}>
            {summaryInHeader ? sums?.[column.id] : null}
          </TableCell>
        ))}
      </TableRow>
    ) : summaryInHeader && first ? (
      <TableRow className={rowClass}>
        <TableHead
          scope="rowgroup"
          style={cellStyle}
          className={cx('ag-whitespace-nowrap ag-py-1.5', first.headerClassName)}
        >
          <span className="ag-flex ag-items-center ag-gap-2">
            {label}
            {sums?.[first.id] != null && (
              <span
                className={cx(
                  'ag-ml-auto ag-text-neutral-900 dark:ag-text-neutral-100',
                  weight,
                  alignmentClass(first.align),
                )}
              >
                {sums[first.id]}
              </span>
            )}
          </span>
        </TableHead>
        {rest.map(column => (
          <TableCell key={column.id} className={cx(weight, alignmentClass(column.align), column.cellClassName)}>
            {sums?.[column.id]}
          </TableCell>
        ))}
      </TableRow>
    ) : (
      <TableRow className={rowClass}>
        <TableHead scope="rowgroup" colSpan={span} style={cellStyle} className="ag-whitespace-nowrap ag-py-1.5">
          {label}
        </TableHead>
      </TableRow>
    );

    const footerRow =
      placement === 'footer' && hasSummary ? (
        <TableRow className={SUMMARY_ROW_CLASS}>
          {hasGroupColumn && (
            <TableCell style={cellStyle} className={cx('ag-whitespace-nowrap', groupCell.cellClassName)}>
              <span className={MUTED_CLASS}>{totalLabel} </span>
              {node.value ?? emptyGroupLabel}
            </TableCell>
          )}
          {columns.map((column, index) => (
            <TableCell
              key={column.id}
              style={!hasGroupColumn && index === 0 ? cellStyle : undefined}
              className={cx(alignmentClass(column.align), column.cellClassName)}
            >
              {sums?.[column.id]}
            </TableCell>
          ))}
        </TableRow>
      ) : null;

    const out: React.ReactNode[] = [
      <tbody key={node.key}>
        {headerRow}
        {leaf &&
          open &&
          node.records.map((record, rowIndex) => (
            <RecordRow
              key={getRowKey(record, rowIndex)}
              record={record}
              rowIndex={rowIndex}
              columns={columns}
              leading={hasGroupColumn ? null : undefined}
              leadingClassName={groupCell.cellClassName ?? ''}
              className={typeof rowClassName === 'function' ? rowClassName(record, rowIndex) : rowClassName}
            />
          ))}
        {leaf && open && footerRow}
      </tbody>,
    ];

    if (!leaf && open) {
      for (const child of node.children) out.push(...renderNode(child));
      if (footerRow) out.push(<tbody key={`${node.key}:footer`}>{footerRow}</tbody>);
    }

    return out;
  };

  return (
    <div className={className} aria-busy={loading || undefined}>
      <Table className={tableClassName} resizable={resizable} columnLines={columnLines}>
        {caption != null && <TableCaption>{caption}</TableCaption>}
        {(hasGroupColumn || columns.length > 0) && (
          <TableHeader>
            <TableRow className="hover:ag-bg-transparent dark:hover:ag-bg-transparent">
              {hasGroupColumn && (
                <TableHead
                  scope="col"
                  className={groupCell.headerClassName}
                  style={{width: groupCell.width}}
                  resizable={groupCell.resizable}
                  minWidth={groupCell.minWidth}
                  maxWidth={groupCell.maxWidth}
                  resizeLabel={groupCell.resizeLabel ?? 'Resize group column'}
                >
                  {groupCell.header ?? <span className="ag-sr-only">Group</span>}
                </TableHead>
              )}
              {columns.map(column => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cx(alignmentClass(column.align), column.headerClassName)}
                  style={{width: column.width}}
                  resizable={column.resizable}
                  minWidth={column.minWidth}
                  maxWidth={column.maxWidth}
                  resizeLabel={column.resizeLabel}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        {loading ? (
          <tbody>
            <TableStateRow colSpan={span}>
              <span className="ag-inline-flex ag-items-center ag-gap-2 ag-text-neutral-500 dark:ag-text-neutral-400">
                <Spinner aria-label={loadingLabel} />
                <span>{loadingLabel}</span>
              </span>
            </TableStateRow>
          </tbody>
        ) : tree.length === 0 ? (
          <tbody>
            <TableStateRow colSpan={span}>
              <Text as="span" variant="muted">
                {emptyMessage}
              </Text>
            </TableStateRow>
          </tbody>
        ) : (
          tree.flatMap(renderNode)
        )}
      </Table>
    </div>
  );
}
