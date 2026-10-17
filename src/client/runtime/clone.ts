/**
 * Copies the writable cells of a record into a values object `create`
 * accepts — the read half of duplicating a record.
 *
 * Walks the generated meta, not the live table, so only fields the app was
 * generated against are copied, each resolved by ID and converted from its
 * read shape to its write shape (`{id, name, color}` → `{id}`).
 */

import type {SdkRecord, SdkTable} from '../sdk.js';
import type {AirgenTableMeta} from '../useTypedRecords.js';
import {inspectField} from './fields.js';

/** An SDK record, or a `useRecords` row (which carries it as `raw`). */
export type RecordSource = SdkRecord | {readonly raw: SdkRecord};

export interface CloneOptions<Wt> {
  /** Field keys left out of the copy. */
  readonly omit?: ReadonlyArray<keyof Wt & string>;
  /** Values that replace (or add to) the copied ones. */
  readonly overrides?: Partial<Wt>;
}

export function toSdkRecord(record: RecordSource): SdkRecord {
  return 'raw' in record ? record.raw : record;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

/**
 * The writable cells of `record`, keyed by field key. Skips fields that are
 * hidden, deleted, computed, retyped since generation, of a type airgen
 * doesn't know, or empty. Attachments are skipped too: copying them means
 * re-uploading by URL, which is a different feature — pass them in
 * `overrides` to opt in.
 *
 * Override keys whose field isn't writable are dropped rather than kept, so a
 * clone never fails as a whole because one field is hidden from the extension.
 */
export function cloneValues<Wt extends object>(
  record: RecordSource,
  table: SdkTable | null,
  tableMeta: AirgenTableMeta,
  options: CloneOptions<Wt> = {},
): Partial<Wt> {
  const source = toSdkRecord(record);
  const omitted = new Set<string>(options.omit ?? []);
  const values: {[fieldKey: string]: unknown} = {};

  const inspect = (fieldKey: string) => {
    const meta = tableMeta.fields[fieldKey];
    return inspectField(meta && table ? table.getFieldByIdIfExists(meta.id) : null, meta, fieldKey);
  };

  for (const fieldKey of Object.keys(tableMeta.fields)) {
    if (omitted.has(fieldKey)) continue;

    const inspector = inspect(fieldKey);
    const {field, writeKind} = inspector;
    if (!field || !inspector.validation.valid() || !writeKind || writeKind === 'attachments') continue;

    const value = inspector.convertTo(source.getCellValue(field));
    if (!isEmpty(value)) values[fieldKey] = value;
  }

  for (const [fieldKey, value] of Object.entries(options.overrides ?? {})) {
    if (value === undefined || !inspect(fieldKey).validation.valid()) continue;
    values[fieldKey] = value;
  }

  return values as Partial<Wt>;
}
