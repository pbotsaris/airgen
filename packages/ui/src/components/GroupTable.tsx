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

export interface GroupTableProps<TRecord extends Structural> extends Omit<
  RecordTableProps<TRecord>,
  'records' | 'renderExpanded' | 'canExpand' | 'defaultExpanded' | 'expanded' | 'onExpandedChange'
> {
  /** Output of `groupRecords`; several grouped fields nest, one level per field. */
  groups: ReadonlyArray<RecordGroup<TRecord>>;
  /** One prefix per level, shown as "Status: Done". */
  groupLabels?: ReadonlyArray<React.ReactNode>;
  /** Label for a `null` value. @defaultValue '(empty)' */
  emptyGroupLabel?: React.ReactNode;
  /** Replaces the default label; the caret, count and summary stay. */
  renderGroupLabel?: (context: GroupContext<TRecord>) => React.ReactNode;
  /** Show the record count after the label. @defaultValue true */
  showCount?: boolean;
  /** Per-column aggregations for a group, e.g. `{hours: total}`. Called for every level. */
  summary?: (records: ReadonlyArray<TRecord>, context: GroupContext<TRecord>) => GroupSummary;
  /**
   * `header` puts summaries in the group row, visible while collapsed;
   * `footer` adds a totals row after the group's records. @defaultValue 'header'
   */
  summaryPlacement?: 'header' | 'footer';
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
const GROUP_ROW_CLASS =
  'ag-bg-neutral-50 hover:ag-bg-neutral-50 dark:ag-bg-neutral-800/60 dark:hover:ag-bg-neutral-800/60';
const SUMMARY_ROW_CLASS =
  'ag-bg-neutral-50/60 ag-font-medium hover:ag-bg-neutral-50/60 dark:ag-bg-neutral-800/30 dark:hover:ag-bg-neutral-800/30';

/**
 * Renders `groupRecords` output as grouped rows: a header row per group, its
 * records under it, and one nested level per grouped field. Group rows carry
 * an optional per-column `summary` (count, sums, …) either in the header row
 * or in a totals row after the records. Every level collapses independently.
 *
 * @example
 * ```tsx
 * const groups = groupRecords(projects, {fields: ['status', 'owner']});
 * <GroupTable
 *   groups={groups}
 *   columns={['name', 'status', 'owner', 'hours']}
 *   groupLabels={['Status', 'Owner']}
 *   summary={records => ({hours: records.reduce((total, r) => total + (r.fields.hours ?? 0), 0)})}
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
  emptyGroupLabel = '(empty)',
  renderGroupLabel,
  showCount = true,
  summary,
  summaryPlacement = 'header',
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
  const span = Math.max(columns.length, 1);
  const [first, ...rest] = columns;

  const isOpen = (node: GroupNode<TRecord>) =>
    expanded[node.key] ?? (typeof defaultExpanded === 'number' ? node.depth < defaultExpanded : defaultExpanded);

  const renderNode = (node: GroupNode<TRecord>): React.ReactNode[] => {
    const open = isOpen(node);
    const leaf = node.children.length === 0;
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
    const sums = summary ? summary(node.records, context) : undefined;
    const hasSummary = sums !== undefined && Object.keys(sums).length > 0;
    const valueText = node.value ?? (typeof emptyGroupLabel === 'string' ? emptyGroupLabel : 'empty');
    const indent = {paddingLeft: 12 + node.depth * 16};

    const label = (
      <span className="ag-inline-flex ag-items-center ag-gap-1 ag-text-neutral-900 dark:ag-text-neutral-100">
        {collapsible && (
          <CaretButton
            size="icon-xs"
            variant="ghost"
            direction="right"
            open={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${valueText}`}
            onClick={() => setExpanded({...expanded, [node.key]: !open})}
          />
        )}
        <span>
          {renderGroupLabel ? (
            renderGroupLabel(context)
          ) : (
            <>
              {groupLabels?.[node.depth] != null && (
                <span className="ag-text-neutral-500 dark:ag-text-neutral-400">{groupLabels[node.depth]}: </span>
              )}
              {node.value ?? emptyGroupLabel}
            </>
          )}
        </span>
        {showCount && (
          <span className="ag-font-normal ag-text-neutral-500 dark:ag-text-neutral-400">({node.records.length})</span>
        )}
      </span>
    );

    const headerRow =
      summaryPlacement === 'header' && first ? (
        <TableRow className={GROUP_ROW_CLASS}>
          <TableHead scope="rowgroup" style={indent} className={cx('ag-whitespace-nowrap', first.headerClassName)}>
            <span className="ag-flex ag-items-center ag-gap-2">
              {label}
              {sums?.[first.id] != null && (
                <span
                  className={cx('ag-ml-auto ag-text-neutral-900 dark:ag-text-neutral-100', alignmentClass(first.align))}
                >
                  {sums[first.id]}
                </span>
              )}
            </span>
          </TableHead>
          {rest.map(column => (
            <TableCell
              key={column.id}
              className={cx('ag-font-medium', alignmentClass(column.align), column.cellClassName)}
            >
              {sums?.[column.id]}
            </TableCell>
          ))}
        </TableRow>
      ) : (
        <TableRow className={GROUP_ROW_CLASS}>
          <TableHead scope="rowgroup" colSpan={span} style={indent} className="ag-whitespace-nowrap">
            {label}
          </TableHead>
        </TableRow>
      );

    const footerRow =
      summaryPlacement === 'footer' && hasSummary ? (
        <TableRow className={SUMMARY_ROW_CLASS}>
          {columns.map((column, index) => (
            <TableCell
              key={column.id}
              style={index === 0 ? indent : undefined}
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
        {columns.length > 0 && (
          <TableHeader>
            <TableRow className="hover:ag-bg-transparent dark:hover:ag-bg-transparent">
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
