/**
 * Untyped views of the generated hooks and meta, so panels can iterate over
 * whatever tables the interface currently grants. The typed API is exercised
 * separately in panels/Typed.tsx; everything here is the same runtime code
 * reached through a string key.
 */
import type {FieldInspector, MutableTable, QuerySpec, SdkRecord, SdkTable} from 'airgen/interface';
import {airgenMeta, useFields, useMutations, useQuery, useRecords, useTable} from '../airtable-schema';

export interface Row {
  id: string;
  name: string;
  fields: {[fieldKey: string]: unknown};
  raw: SdkRecord;
}

export interface FieldMeta {
  readonly id: string;
  readonly name?: string;
  readonly type: string;
  readonly isComputed?: boolean;
  readonly linkedTableId?: string;
  readonly choices?: unknown;
}

export interface TableMeta {
  readonly id: string;
  readonly name: string;
  readonly primaryFieldId?: string;
  readonly fields: {readonly [fieldKey: string]: FieldMeta};
}

export type IncludeTree = {[fieldKey: string]: true | IncludeTree};

export const meta = airgenMeta as unknown as {
  version?: number;
  baseId: string;
  signature: string;
  tables: {readonly [tableKey: string]: TableMeta};
};

export const tableKeys = (): string[] => Object.keys(meta.tables);

export const dyn = {
  useRecords: useRecords as unknown as (key: string, options?: {include?: IncludeTree}) => Row[],
  useQuery: useQuery as unknown as (key: string, spec?: QuerySpec<Row> & {include?: IncludeTree}) => Row[],
  useTable: useTable as unknown as (key: string) => SdkTable | null,
  useFields: useFields as unknown as (key: string) => {readonly [fieldKey: string]: FieldInspector},
  useMutations: useMutations as unknown as (key: string) => MutableTable<{[fieldKey: string]: unknown}>,
};

/** Table key for a table ID, or null when the link points outside the generated file. */
export function tableKeyById(tableId: string | undefined): string | null {
  if (!tableId) return null;
  return tableKeys().find(key => meta.tables[key].id === tableId) ?? null;
}

/** Link fields of a table whose target is in the generated file (what TableLinkMap offers). */
export function includableLinks(tableKey: string): Array<{fieldKey: string; target: string}> {
  return Object.entries(meta.tables[tableKey]?.fields ?? {}).flatMap(([fieldKey, field]) => {
    const target = field.type === 'multipleRecordLinks' ? tableKeyById(field.linkedTableId) : null;
    return target ? [{fieldKey, target}] : [];
  });
}

/** Every includable link, nested once more where the target has links off the path: the widest legal spec. */
export function widestInclude(tableKey: string, depth = 2, visited: string[] = [tableKey]): IncludeTree {
  const tree: IncludeTree = {};
  for (const {fieldKey, target} of includableLinks(tableKey)) {
    if (visited.includes(target)) continue;
    const nested = depth > 1 ? widestInclude(target, depth - 1, [...visited, target]) : {};
    tree[fieldKey] = Object.keys(nested).length > 0 ? nested : true;
  }
  return tree;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) return String(a) === String(b);
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual((a as {[k: string]: unknown})[k], (b as {[k: string]: unknown})[k]));
}

export function preview(value: unknown, max = 140): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
