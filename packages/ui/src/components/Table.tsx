import * as React from 'react';

import {PillOption} from './PillOption.js';
import {Spinner} from './Spinner.js';
import {Text} from './Text.js';
import {cx} from '../utils.js';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes applied to the scroll container around the native table. */
  containerClassName?: string;
}

/** Minimal, horizontally scrollable native table styled for Airtable extensions. */
export const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  {className, containerClassName, ...props},
  ref,
) {
  return (
    <div
      className={cx(
        'w-full overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-700',
        containerClassName,
      )}
    >
      <table ref={ref} className={cx('w-full caption-bottom border-collapse text-base', className)} {...props} />
    </div>
  );
});

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({className, ...props}, ref) {
    return <thead ref={ref} className={cx('bg-neutral-50 dark:bg-neutral-800/60', className)} {...props} />;
  },
);

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({className, ...props}, ref) {
    return <tbody ref={ref} className={cx('[&_tr:last-child]:border-0', className)} {...props} />;
  },
);

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  function TableFooter({className, ...props}, ref) {
    return (
      <tfoot
        ref={ref}
        className={cx(
          'border-t border-neutral-200 bg-neutral-50 font-medium dark:border-neutral-700 dark:bg-neutral-800/60',
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({className, ...props}, ref) {
    return (
      <tr
        ref={ref}
        className={cx(
          'border-b border-neutral-200 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800/50',
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({className, ...props}, ref) {
    return (
      <th
        ref={ref}
        className={cx('h-9 px-3 text-left align-middle font-medium text-neutral-500 dark:text-neutral-400', className)}
        {...props}
      />
    );
  },
);

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({className, ...props}, ref) {
    return (
      <td
        ref={ref}
        className={cx('px-3 py-2 align-middle text-neutral-900 dark:text-neutral-100', className)}
        {...props}
      />
    );
  },
);

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  function TableCaption({className, ...props}, ref) {
    return (
      <caption ref={ref} className={cx('mt-3 text-sm text-neutral-500 dark:text-neutral-400', className)} {...props} />
    );
  },
);

/** Structural shape returned by airgen's generated `useRecords` hook. */
export interface RecordTableRecord<TFields extends object = Record<string, unknown>> {
  id: string;
  fields: Partial<TFields>;
  raw: unknown;
}

export type RecordTableFieldKey<TRecord extends {id: string; fields: object}> = Extract<
  keyof TRecord['fields'],
  string
>;

export interface RecordTableCellContext<TRecord extends {id: string; fields: object}> {
  record: TRecord;
  value: unknown;
  rowIndex: number;
}

interface RecordTableColumnOptions<TRecord extends {id: string; fields: object}> {
  width?: number | string;
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

export interface RecordTableProps<TRecord extends {id: string; fields: object}> {
  records: ReadonlyArray<TRecord>;
  /**
   * Fields to show, in order. Omit to infer all populated field keys from the
   * records. String entries are a typed shorthand for `{id: fieldKey}`.
   */
  columns?: ReadonlyArray<RecordTableFieldKey<TRecord> | RecordTableColumn<TRecord>>;
  caption?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  getRowKey?: (record: TRecord, index: number) => React.Key;
  rowClassName?: string | ((record: TRecord, index: number) => string | undefined);
  className?: string;
  tableClassName?: string;
}

/**
 * Renders records from airgen's generated `useRecords` hook. It deliberately
 * depends only on the hook's structural result, so the root entry remains
 * compatible with every Airtable SDK flavor.
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
}: RecordTableProps<TRecord>) {
  const columns = resolveColumns(records, columnsProp);

  return (
    <div className={className} aria-busy={loading || undefined}>
      <Table className={tableClassName}>
        {caption != null && <TableCaption>{caption}</TableCaption>}
        {columns.length > 0 && (
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              {columns.map(column => (
                <TableHead
                  key={column.id}
                  scope="col"
                  className={cx(alignmentClass(column.align), column.headerClassName)}
                  style={{width: column.width}}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {loading ? (
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableCell colSpan={Math.max(columns.length, 1)} className="h-20 text-center">
                <span className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <Spinner aria-label={loadingLabel} />
                  <span>{loadingLabel}</span>
                </span>
              </TableCell>
            </TableRow>
          ) : records.length === 0 ? (
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableCell colSpan={Math.max(columns.length, 1)} className="h-20 text-center">
                <Text as="span" variant="muted">
                  {emptyMessage}
                </Text>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record, rowIndex) => (
              <TableRow
                key={getRowKey(record, rowIndex)}
                className={typeof rowClassName === 'function' ? rowClassName(record, rowIndex) : rowClassName}
              >
                {columns.map(column => {
                  const value = column.accessor
                    ? column.accessor(record)
                    : (record.fields as Record<string, unknown>)[column.id];

                  return (
                    <TableCell key={column.id} className={cx(alignmentClass(column.align), column.cellClassName)}>
                      {column.cell ? column.cell({record, value, rowIndex}) : <RecordCellValue value={value} />}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export interface RecordCellValueProps {
  value: unknown;
  empty?: React.ReactNode;
  className?: string;
}

/** Default renderer for common Airtable cell shapes emitted by airgen. */
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
      <span className={cx('flex flex-wrap items-center gap-1.5', className)}>
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

function alignmentClass(align: RecordTableColumn<{id: string; fields: object}>['align']): string | undefined {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return undefined;
}

interface ResolvedRecordTableColumn<
  TRecord extends {id: string; fields: object},
> extends RecordTableColumnOptions<TRecord> {
  id: string;
  header: React.ReactNode;
  accessor?: (record: TRecord) => unknown;
}

function resolveColumns<TRecord extends {id: string; fields: object}>(
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

function humanizeFieldKey(fieldKey: string): string {
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
