import * as React from 'react';

import {CaretButton} from './CaretButton.js';
import {PillOption} from './PillOption.js';
import {Spinner} from './Spinner.js';
import {Text} from './Text.js';
import {cx, mergeRefs, useControllableState, useStableId} from '../utils.js';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes applied to the scroll container around the native table. */
  containerClassName?: string;
  /** Enable resizing for a single row of column headers. @defaultValue false */
  resizable?: boolean;
  /** Show vertical dividers between header, body, and footer cells. @defaultValue false */
  columnLines?: boolean;
}

interface TableResizeContextValue {
  widths: number[];
  resize: (header: HTMLTableCellElement, width: number) => void;
}

const TableResizeContext = React.createContext<TableResizeContextValue | null>(null);

/**
 * Native table inside a horizontally scrollable border container. Composes with
 * the TableHeader/Body/Row/Head/Cell primitives; ref points to the table itself.
 * Use RecordTable to render `{id, fields}` records with automatic cell formatting.
 *
 * @example
 * ```tsx
 * <Table>
 *   <TableCaption>Projects</TableCaption>
 *   <TableHeader><TableRow><TableHead scope="col">Name</TableHead></TableRow></TableHeader>
 *   <TableBody><TableRow><TableCell>Website</TableCell></TableRow></TableBody>
 * </Table>;
 * ```
 */
export const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  {className, containerClassName, resizable = false, columnLines = false, children, style, ...props},
  ref,
) {
  const [widths, setWidths] = React.useState<number[]>([]);
  const resize = React.useCallback((header: HTMLTableCellElement, width: number) => {
    const cells = header.parentElement?.children;
    if (!cells) return;
    const measured = Array.from(cells, cell => cell.getBoundingClientRect().width);
    const index = header.cellIndex;
    setWidths(previous => {
      const next = previous.length === measured.length ? [...previous] : measured;
      next[index] = width;
      return next;
    });
  }, []);
  const context = React.useMemo(() => (resizable ? {widths, resize} : null), [resizable, widths, resize]);
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  return (
    <TableResizeContext.Provider value={context}>
      <div
        className={cx(
          'ag-w-full ag-overflow-x-auto ag-rounded-md ag-border ag-border-neutral-200 dark:ag-border-neutral-700',
          containerClassName,
        )}
      >
        <table
          ref={ref}
          className={cx(
            'ag-w-full ag-caption-bottom ag-border-collapse ag-text-base',
            columnLines && 'ag-column-lines',
            className,
          )}
          {...props}
          style={{...style, ...(resizable && widths.length > 0 ? {tableLayout: 'fixed', width: tableWidth} : {})}}
        >
          {resizable && widths.length > 0 && (
            <colgroup>
              {widths.map((width, index) => (
                <col key={index} style={{width}} />
              ))}
            </colgroup>
          )}
          {children}
        </table>
      </div>
    </TableResizeContext.Provider>
  );
});

/** Styled `thead`; place header rows here. Accepts native attributes and forwards its ref. */
export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({className, ...props}, ref) {
    return <thead ref={ref} className={cx('ag-bg-neutral-50 dark:ag-bg-neutral-800/60', className)} {...props} />;
  },
);

/** Styled `tbody`; place data rows here. Accepts native attributes and forwards its ref. */
export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({className, ...props}, ref) {
    return <tbody ref={ref} className={cx('[&_tr:last-child]:ag-border-0', className)} {...props} />;
  },
);

/** Styled `tfoot` for summary rows. Accepts native attributes and forwards its ref. */
export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableFooter({className, ...props}, ref) {
    return (
      <tfoot
        ref={ref}
        className={cx(
          'ag-border-t ag-border-neutral-200 ag-bg-neutral-50 ag-font-medium dark:ag-border-neutral-700 dark:ag-bg-neutral-800/60',
          className,
        )}
        {...props}
      />
    );
  },
);

/** Styled `tr` with a bottom border and hover treatment. Accepts native attributes and forwards its ref. */
export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({className, ...props}, ref) {
    return (
      <tr
        ref={ref}
        className={cx(
          'ag-border-b ag-border-neutral-200 ag-transition-colors hover:ag-bg-neutral-50 dark:ag-border-neutral-700 dark:hover:ag-bg-neutral-800/50',
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * Styled `th`; set `scope="col"` or `scope="row"` to associate headers with cells.
 * Accepts native attributes and forwards its ref.
 */
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Disable resizing for this column when the table is resizable. @defaultValue true */
  resizable?: boolean;
  /** Minimum resized width in pixels. @defaultValue 80 */
  minWidth?: number;
  /** Maximum resized width in pixels. */
  maxWidth?: number;
  /** Accessible resize handle name, useful for non-text headers. */
  resizeLabel?: string;
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead(
  {
    className,
    children,
    resizable = true,
    minWidth = 80,
    maxWidth,
    resizeLabel,
    scope,
    colSpan = 1,
    rowSpan = 1,
    ...props
  },
  ref,
) {
  const context = React.useContext(TableResizeContext);
  const headerRef = React.useRef<HTMLTableCellElement | null>(null);
  const mergedRef = React.useMemo(() => mergeRefs(headerRef, ref), [ref]);
  const drag = React.useRef<{pointerId: number; x: number; width: number; direction: number} | null>(null);
  const enabled =
    context !== null && resizable && scope !== 'row' && scope !== 'rowgroup' && colSpan === 1 && rowSpan === 1;
  const [measuredWidth, setMeasuredWidth] = React.useState<number>();
  React.useEffect(() => {
    if (enabled) setMeasuredWidth(headerRef.current?.getBoundingClientRect().width);
  }, [enabled]);
  const minimum = Math.max(1, minWidth);
  const maximum = maxWidth === undefined ? undefined : Math.max(minimum, maxWidth);
  const resizedWidth = headerRef.current ? context?.widths[headerRef.current.cellIndex] : undefined;
  const width = resizedWidth ?? measuredWidth;
  const getWidth = () => resizedWidth ?? headerRef.current?.getBoundingClientRect().width ?? minimum;
  const resize = (value: number) => {
    if (headerRef.current) context?.resize(headerRef.current, Math.min(maximum ?? Infinity, Math.max(minimum, value)));
  };
  const direction = () => (headerRef.current && getComputedStyle(headerRef.current).direction === 'rtl' ? -1 : 1);

  return (
    <th
      ref={mergedRef}
      scope={scope}
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cx(
        'ag-h-9 ag-px-3 ag-text-left ag-align-middle ag-font-medium ag-text-neutral-500 dark:ag-text-neutral-400',
        enabled && 'ag-relative ag-pr-4',
        context && 'ag-overflow-hidden',
        className,
      )}
      {...props}
    >
      {children}
      {enabled && (
        <span
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={resizeLabel ?? `Resize ${typeof children === 'string' ? children : 'column'}`}
          aria-valuemin={minimum}
          aria-valuemax={maximum}
          aria-valuenow={Math.round(width ?? minimum)}
          onFocus={() => setMeasuredWidth(headerRef.current?.getBoundingClientRect().width)}
          className="ag-absolute ag-inset-y-0 ag-right-0 ag-w-2 ag-cursor-col-resize ag-touch-none ag-select-none after:ag-absolute after:ag-inset-y-0 after:ag-right-0 after:ag-w-px hover:after:ag-bg-neutral-300 focus-visible:ag-outline-none focus-visible:after:ag-bg-neutral-300 dark:hover:after:ag-bg-neutral-400 dark:focus-visible:after:ag-bg-neutral-400"
          onClick={event => event.stopPropagation()}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {pointerId: event.pointerId, x: event.clientX, width: getWidth(), direction: direction()};
          }}
          onPointerMove={event => {
            const start = drag.current;
            if (start && start.pointerId === event.pointerId) {
              resize(start.width + (event.clientX - start.x) * start.direction);
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={event => {
            let next: number;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              next = getWidth() + (event.key === 'ArrowRight' ? 1 : -1) * direction() * (event.shiftKey ? 50 : 10);
            } else if (event.key === 'Home') next = minimum;
            else if (event.key === 'End' && maximum !== undefined) next = maximum;
            else return;
            event.preventDefault();
            event.stopPropagation();
            resize(next);
          }}
        />
      )}
    </th>
  );
});

/** Styled `td` for a data cell. Accepts native attributes and forwards its ref. */
export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({className, ...props}, ref) {
    const context = React.useContext(TableResizeContext);
    return (
      <td
        ref={ref}
        className={cx(
          'ag-px-3 ag-py-2 ag-align-middle ag-text-neutral-900 dark:ag-text-neutral-100',
          context && 'ag-overflow-hidden',
          className,
        )}
        {...props}
      />
    );
  },
);

/** Styled `caption` that names or describes the table. Accepts native attributes and forwards its ref. */
export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  function TableCaption({className, ...props}, ref) {
    return (
      <caption
        ref={ref}
        className={cx('ag-mt-3 ag-text-sm ag-text-neutral-500 dark:ag-text-neutral-400', className)}
        {...props}
      />
    );
  },
);

/** Structural shape returned by airgen's generated `useRecords` hook. */
export interface RecordTableRecord<TFields extends object = Record<string, unknown>> {
  id: string;
  fields: Partial<TFields>;
  raw: unknown;
}

/** String field keys inferred from a record's `fields` object. */
export type RecordTableFieldKey<TRecord extends {id: string; fields: object}> = Extract<
  keyof TRecord['fields'],
  string
>;

/** Inputs to a column's custom cell renderer. */
export interface RecordTableCellContext<TRecord extends {id: string; fields: object}> {
  /** Complete record for this row. */
  record: TRecord;
  /** Field value or the result of the column accessor. */
  value: unknown;
  /** Zero-based index in the supplied records. */
  rowIndex: number;
}

interface RecordTableColumnOptions<TRecord extends {id: string; fields: object}> {
  /** Column width in pixels (number) or a CSS width string. */
  width?: number | string;
  /** Disable resizing for this column. @defaultValue true */
  resizable?: boolean;
  /** Minimum resized width in pixels. @defaultValue 80 */
  minWidth?: number;
  /** Maximum resized width in pixels. */
  maxWidth?: number;
  /** Accessible resize handle name, useful for non-text headers. */
  resizeLabel?: string;
  /** Header and cell text alignment. @defaultValue 'left' */
  align?: 'left' | 'center' | 'right';
  headerClassName?: string;
  cellClassName?: string;
  /** Override the default Airtable-aware value renderer. */
  cell?: (context: RecordTableCellContext<TRecord>) => React.ReactNode;
}

/**
 * A generated field column, or a derived column with an accessor. Field ids
 * autocomplete from the record type; derived ids require `accessor`.
 */
export type RecordTableColumn<TRecord extends {id: string; fields: object}> =
  | (RecordTableColumnOptions<TRecord> & {
      id: RecordTableFieldKey<TRecord>;
      /** Defaults to a humanized field key. */
      header?: React.ReactNode;
      accessor?: never;
    })
  | (RecordTableColumnOptions<TRecord> & {
      id: string;
      header: React.ReactNode;
      /** Reads a derived value or supplies data for a display/action column. */
      accessor: (record: TRecord) => unknown;
    });

/** Inputs to `renderExpanded`. */
export interface RecordTableExpandContext<TRecord> {
  /** Record whose row is expanded. */
  record: TRecord;
  /** Zero-based index in the supplied records. */
  rowIndex: number;
  /** Always true when rendering; present for symmetry with future hooks. */
  expanded: boolean;
}

/** Per-row expansion overrides, keyed by the row key (`String(getRowKey(record))`). */
export type RecordTableExpandedMap = Readonly<Record<string, boolean>>;

export interface RecordTableProps<TRecord extends {id: string; fields: object}> {
  /** Enable pointer and keyboard column resizing. @defaultValue false */
  resizable?: boolean;
  /** Show vertical dividers between columns. @defaultValue false */
  columnLines?: boolean;
  /** Rows to display; `id` is the default row key and `fields` supplies cell values. */
  records: ReadonlyArray<TRecord>;
  /**
   * Fields to show, in order. Omit to infer all populated field keys from the
   * records. String entries are a typed shorthand for `{id: fieldKey}`.
   */
  columns?: ReadonlyArray<RecordTableFieldKey<TRecord> | RecordTableColumn<TRecord>>;
  /** Accessible table caption, displayed below the table. */
  caption?: React.ReactNode;
  /** Content shown when there are no records. @defaultValue 'No records.' */
  emptyMessage?: React.ReactNode;
  /** Replace data rows with a loading row and mark the wrapper busy. @defaultValue false */
  loading?: boolean;
  /** Visible loading text and spinner accessible name. @defaultValue 'Loading records' */
  loadingLabel?: string;
  /** Stable React row key; defaults to the record id. */
  getRowKey?: (record: TRecord, index: number) => React.Key;
  /** Classes on each data row, or a function of the record and zero-based index. */
  rowClassName?: string | ((record: TRecord, index: number) => string | undefined);
  /** Classes on the outer RecordTable wrapper. */
  className?: string;
  /** Classes on the native table element. */
  tableClassName?: string;
  /**
   * Adds a leading toggle column; the result renders in a full-width row
   * under the record while it is expanded.
   */
  renderExpanded?: (context: RecordTableExpandContext<TRecord>) => React.ReactNode;
  /** Rows that get a toggle; others keep an empty leading cell. @defaultValue () => true */
  canExpand?: (record: TRecord, rowIndex: number) => boolean;
  /** Initial state of rows absent from `expanded`. @defaultValue false */
  defaultExpanded?: boolean | ((record: TRecord, rowIndex: number) => boolean);
  /** Per-row overrides of `defaultExpanded`, keyed by the row key. Controlled when supplied. */
  expanded?: RecordTableExpandedMap;
  /** Receives the full override map after every toggle. */
  onExpandedChange?: (expanded: RecordTableExpandedMap) => void;
}

const NO_OVERRIDES: RecordTableExpandedMap = {};

/**
 * Renders records from airgen's generated `useRecords` hook. It deliberately
 * depends only on the hook's structural result, so the root entry remains
 * compatible with every Airtable SDK flavor. Inferred columns only include
 * field keys present in the supplied records; specify `columns` to keep empty
 * fields visible. Custom cells receive the record, resolved value, and row index.
 *
 * Pass `renderExpanded` for expandable rows: a toggle column is prepended and
 * the renderer's output appears in a full-width row under each expanded
 * record. Expansion is uncontrolled by default (`defaultExpanded`); supply
 * `expanded` and `onExpandedChange` to control it.
 *
 * @example Typed field columns and a derived column
 * ```tsx
 * const records = [{id: 'rec1', fields: {name: 'Website', hours: 4}}];
 * <RecordTable
 *   records={records}
 *   caption="Projects"
 *   columns={[
 *     'name',
 *     {id: 'hours', header: 'Hours', align: 'right'},
 *     {id: 'double', header: 'Double hours', accessor: record => record.fields.hours * 2},
 *   ]}
 * />;
 * ```
 *
 * @example Expandable rows
 * ```tsx
 * <RecordTable records={records} renderExpanded={({record}) => <pre>{JSON.stringify(record.fields)}</pre>} />;
 * ```
 */
export function RecordTable<TRecord extends {id: string; fields: object}>({
  records,
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
  renderExpanded,
  canExpand,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
}: RecordTableProps<TRecord>) {
  const columns = resolveColumns(records, columnsProp);
  const [expanded, setExpanded] = useControllableState<RecordTableExpandedMap>({
    value: expandedProp,
    defaultValue: NO_OVERRIDES,
    onChange: onExpandedChange,
  });
  const baseId = useStableId('record-table');
  const lead = renderExpanded ? 1 : 0;
  const span = Math.max(lead + columns.length, 1);

  return (
    <div className={className} aria-busy={loading || undefined}>
      <Table className={tableClassName} resizable={resizable} columnLines={columnLines}>
        {caption != null && <TableCaption>{caption}</TableCaption>}
        {lead + columns.length > 0 && (
          <TableHeader>
            <TableRow className="hover:ag-bg-transparent dark:hover:ag-bg-transparent">
              {renderExpanded && (
                <TableHead scope="col" resizable={false} className="ag-w-10 ag-pr-0" style={{width: 40}}>
                  <span className="ag-sr-only">Expand</span>
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
        <TableBody>
          {loading ? (
            <TableStateRow colSpan={span}>
              <span className="ag-inline-flex ag-items-center ag-gap-2 ag-text-neutral-500 dark:ag-text-neutral-400">
                <Spinner aria-label={loadingLabel} />
                <span>{loadingLabel}</span>
              </span>
            </TableStateRow>
          ) : records.length === 0 ? (
            <TableStateRow colSpan={span}>
              <Text as="span" variant="muted">
                {emptyMessage}
              </Text>
            </TableStateRow>
          ) : (
            records.map((record, rowIndex) => {
              const key = getRowKey(record, rowIndex);
              const expandable = renderExpanded !== undefined && (canExpand ? canExpand(record, rowIndex) : true);
              const isOpen =
                expandable &&
                (expanded[String(key)] ??
                  (typeof defaultExpanded === 'function' ? defaultExpanded(record, rowIndex) : defaultExpanded));
              const detailId = `${baseId}-detail-${rowIndex}`;
              const leading = !renderExpanded ? undefined : !expandable ? null : (
                <CaretButton
                  size="icon-xs"
                  variant="ghost"
                  direction="right"
                  open={isOpen}
                  aria-label={isOpen ? 'Collapse row' : 'Expand row'}
                  aria-controls={isOpen ? detailId : undefined}
                  onClick={() => setExpanded(previous => ({...previous, [String(key)]: !isOpen}))}
                />
              );

              return (
                <React.Fragment key={key}>
                  <RecordRow
                    record={record}
                    rowIndex={rowIndex}
                    columns={columns}
                    leading={leading}
                    className={typeof rowClassName === 'function' ? rowClassName(record, rowIndex) : rowClassName}
                  />
                  {isOpen && renderExpanded && (
                    <TableRow id={detailId} className="hover:ag-bg-transparent dark:hover:ag-bg-transparent">
                      <TableCell colSpan={span} className="ag-p-0 ag-bg-neutral-50/60 dark:ag-bg-neutral-800/30">
                        {renderExpanded({record, rowIndex, expanded: true})}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** @internal One record row: an optional leading cell, then one cell per resolved column. */
export function RecordRow<TRecord extends {id: string; fields: object}>({
  record,
  rowIndex,
  columns,
  className,
  leading,
  leadingClassName = 'ag-w-10 ag-py-1 ag-pr-0',
}: {
  record: TRecord;
  rowIndex: number;
  columns: ReadonlyArray<ResolvedRecordTableColumn<TRecord>>;
  className?: string;
  /** `undefined` renders no leading cell; `null` an empty one. */
  leading?: React.ReactNode;
  /** Classes on the leading cell; defaults to the narrow toggle column. */
  leadingClassName?: string;
}) {
  return (
    <TableRow className={className}>
      {leading !== undefined && <TableCell className={leadingClassName}>{leading}</TableCell>}
      {columns.map(column => {
        const value = column.accessor ? column.accessor(record) : (record.fields as Record<string, unknown>)[column.id];

        return (
          <TableCell key={column.id} className={cx(alignmentClass(column.align), column.cellClassName)}>
            {column.cell ? column.cell({record, value, rowIndex}) : <RecordCellValue value={value} />}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

/** @internal Full-width row for loading and empty states. */
export function TableStateRow({colSpan, children}: {colSpan: number; children: React.ReactNode}) {
  return (
    <TableRow className="hover:ag-bg-transparent dark:hover:ag-bg-transparent">
      <TableCell colSpan={colSpan} className="ag-h-20 ag-text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}

export interface RecordCellValueProps {
  /** Airtable cell value, including arrays, named objects, lookups, and primitives. */
  value: unknown;
  /** Content for null, undefined, empty strings, and empty arrays. @defaultValue '—' */
  empty?: React.ReactNode;
  className?: string;
}

/**
 * Default renderer for common Airtable cell shapes emitted by airgen. Named
 * objects render as pills, arrays render each value, Dates use local formatting,
 * and booleans render as Yes/No. Unknown objects fall back to serialized text.
 *
 * @example
 * ```tsx
 * <RecordCellValue value={{id: 'sel1', name: 'Done', color: 'greenBright'}} />;
 * <RecordCellValue value={null} empty="Not set" />;
 * ```
 */
export function RecordCellValue({value, empty = '—', className}: RecordCellValueProps) {
  if (value == null || value === '') {
    return (
      <Text as="span" variant="muted" className={className}>
        {empty}
      </Text>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <RecordCellValue value={null} empty={empty} className={className} />;

    return (
      <span className={cx('ag-flex ag-flex-wrap ag-items-center ag-gap-1.5', className)}>
        {value.map((item, index) => (
          <RecordCellValue key={cellValueKey(item, index)} value={unwrapLookup(item)} empty={empty} />
        ))}
      </span>
    );
  }

  if (value instanceof Date) return <span className={className}>{value.toLocaleString()}</span>;

  if (typeof value === 'object') {
    const named = value as {id?: unknown; name?: unknown; color?: unknown; profilePicUrl?: unknown};
    if (typeof named.name === 'string') {
      return (
        <PillOption
          size="sm"
          className={className}
          opt={{
            value: typeof named.id === 'string' ? named.id : named.name,
            label: named.name,
            color: typeof named.color === 'string' ? named.color : undefined,
            profilePicUrl: typeof named.profilePicUrl === 'string' ? named.profilePicUrl : undefined,
          }}
        />
      );
    }

    const display = value as {email?: unknown; filename?: unknown; value?: unknown};
    if (typeof display.email === 'string') return <span className={className}>{display.email}</span>;
    if (typeof display.filename === 'string') return <span className={className}>{display.filename}</span>;
    if ('value' in display) return <RecordCellValue value={display.value} empty={empty} className={className} />;

    return (
      <Text as="span" variant="muted" className={className}>
        {safeStringify(value)}
      </Text>
    );
  }

  return <span className={className}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>;
}

/** @internal */
export function alignmentClass(align: RecordTableColumn<{id: string; fields: object}>['align']): string | undefined {
  if (align === 'center') return 'ag-text-center';
  if (align === 'right') return 'ag-text-right';
  return undefined;
}

/** @internal A column with its header resolved. */
export interface ResolvedRecordTableColumn<
  TRecord extends {id: string; fields: object},
> extends RecordTableColumnOptions<TRecord> {
  id: string;
  header: React.ReactNode;
  accessor?: (record: TRecord) => unknown;
}

/** @internal Columns as given, or one per field key populated in `records`. */
export function resolveColumns<TRecord extends {id: string; fields: object}>(
  records: ReadonlyArray<TRecord>,
  columns: ReadonlyArray<RecordTableFieldKey<TRecord> | RecordTableColumn<TRecord>> | undefined,
): Array<ResolvedRecordTableColumn<TRecord>> {
  if (columns !== undefined) {
    return columns.map(column => {
      if (typeof column === 'string') return {id: column, header: humanizeFieldKey(column)};
      return {...column, header: column.header ?? humanizeFieldKey(column.id)};
    });
  }

  const fieldKeys = new Set<string>();
  for (const record of records) {
    for (const fieldKey of Object.keys(record.fields)) fieldKeys.add(fieldKey);
  }

  return Array.from(fieldKeys, id => ({id, header: humanizeFieldKey(id)}));
}

/** @internal `contactEmail` → `Contact Email`. */
export function humanizeFieldKey(fieldKey: string): string {
  const words = fieldKey.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function unwrapLookup(value: unknown): unknown {
  if (typeof value === 'object' && value !== null && 'linkedRecordId' in value && 'value' in value) {
    return (value as {value: unknown}).value;
  }
  return value;
}

function cellValueKey(value: unknown, index: number): React.Key {
  if (typeof value === 'object' && value !== null) {
    const item = value as {id?: unknown; linkedRecordId?: unknown};
    if (typeof item.id === 'string') return item.id;
    if (typeof item.linkedRecordId === 'string') return `${item.linkedRecordId}-${index}`;
  }
  return index;
}

function safeStringify(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
