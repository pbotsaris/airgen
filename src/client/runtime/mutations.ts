/**
 * Typed writes over one table.
 *
 * `Wt` is the table's generated `<Table>Write` interface, so field keys and
 * values autocomplete and wrong shapes fail to compile. At runtime every key
 * resolves through the generated meta to a field ID and every value goes
 * through `FieldInspector.convertTo`, so read values (a select straight off
 * another record) are accepted as they are.
 *
 * Every operation runs the same pipeline, and none of it throws:
 *
 * 1. validate — a table-level error (missing table, an incompatible
 *    runtime-picked table) or an unknown, hidden, retyped, or computed field
 *    refuses the whole write before the SDK is touched;
 * 2. split into batches of 50 (the SDK's per-call limit) and check
 *    permissions for every batch, again before any write;
 * 3. write batch by batch, stopping at the first failure. Airtable has no
 *    transactions, so batches already written stay written: the failure
 *    reports their ids and which batch failed.
 */

import type {PermissionCheck, SdkCellValues, SdkTable} from '../sdk.js';
import type {AirgenTableMeta} from '../useTypedRecords.js';
import {cloneValues} from './clone.js';
import type {CloneOptions, RecordSource} from './clone.js';
import {inspectField} from './fields.js';
import type {FieldInspector} from './fields.js';
import {ValidationResult} from './validation.js';
import type {ValidationIssue} from './validation.js';

/** Records per SDK call; the SDK rejects larger batches. */
export const BATCH_SIZE = 50;

/** A record, a `useRecords` row, or just a record id. */
export type RecordRef = string | {readonly id: string};

export interface MutationSuccess {
  readonly ok: true;
  /** Ids of the records written: the new ids for creates. */
  readonly ids: ReadonlyArray<string>;
  /** Warnings only (an error would have refused the write). */
  readonly issues: ReadonlyArray<ValidationIssue>;
}

export interface MutationFailure {
  readonly ok: false;
  readonly error: Error;
  /**
   * Ids of the records written before the failure. These are committed —
   * for creates, the caller may want to delete them. Empty when the failure
   * came before any write (validation, permissions, missing table).
   */
  readonly ids: ReadonlyArray<string>;
  /** Index of the batch whose SDK call failed; null when nothing was written. */
  readonly failedBatch: number | null;
  readonly issues: ReadonlyArray<ValidationIssue>;
}

export type MutationResult = MutationSuccess | MutationFailure;

export interface MutableTable<Wt extends object> {
  /** Creates one record; `values` may be empty for a blank row. */
  create(values?: Partial<Wt>): Promise<MutationResult>;
  createMany(valuesList: ReadonlyArray<Partial<Wt>>): Promise<MutationResult>;
  /** Sets one field on one record. */
  update<F extends keyof Wt & string>(record: RecordRef, fieldKey: F, value: Wt[F]): Promise<MutationResult>;
  updateFields(record: RecordRef, values: Partial<Wt>): Promise<MutationResult>;
  /** Per-record updates; pass the same `fields` to every entry to set one value on many records. */
  updateMany(
    updates: ReadonlyArray<{readonly record: RecordRef; readonly fields: Partial<Wt>}>,
  ): Promise<MutationResult>;
  remove(record: RecordRef): Promise<MutationResult>;
  removeMany(records: ReadonlyArray<RecordRef>): Promise<MutationResult>;
  /** Creates a copy of `record`'s writable cells (see `cloneValues`). */
  clone(record: RecordSource, options?: CloneOptions<Wt>): Promise<MutationResult>;
  /** Inspector for any field key of the table, writable or not. */
  inspect(fieldKey: string): FieldInspector;
  /**
   * Table-level issues: a missing table, or what `resolveTableOverride` found
   * on a runtime-picked one. Every write is refused while it holds an error.
   */
  readonly validation: ValidationResult;
  /** Table-level permission checks, for disabling UI before a write is tried. Denied while `validation` has an error. */
  readonly can: {
    create(): PermissionCheck;
    update(): PermissionCheck;
    delete(): PermissionCheck;
  };
}

function recordId(record: RecordRef): string {
  return typeof record === 'string' ? record : record.id;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function chunk<T>(items: ReadonlyArray<T>): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));
  return batches;
}

function failure(
  error: Error,
  issues: ReadonlyArray<ValidationIssue>,
  ids: ReadonlyArray<string> = [],
  failedBatch: number | null = null,
): MutationFailure {
  return {ok: false, error, ids, failedBatch, issues};
}

export interface MutationOptions {
  /** Table-level issues to enforce, e.g. `resolveTableOverride(...).validation`. */
  readonly validation?: ValidationResult;
}

/**
 * Write operations for one table. `table` is the live SDK table, or null when
 * it's deleted or hidden from this extension — every operation then fails
 * with a `table-missing` issue and every permission check is denied.
 */
export function createMutations<Wt extends object>(
  table: SdkTable | null,
  tableMeta: AirgenTableMeta,
  options: MutationOptions = {},
): MutableTable<Wt> {
  const tableMissing: ValidationIssue = {
    kind: 'table-missing',
    level: 'error',
    message: `Table "${tableMeta.name}" is deleted or hidden from this extension.`,
  };
  const tableValidation = ValidationResult.merge([
    table ? ValidationResult.ok : new ValidationResult([tableMissing]),
    options.validation ?? ValidationResult.ok,
  ]);
  const tableError = (): Error => new Error(tableValidation.errors.map(i => i.message).join('\n'));

  function inspect(fieldKey: string): FieldInspector {
    const meta = tableMeta.fields[fieldKey];
    return inspectField(meta && table ? table.getFieldByIdIfExists(meta.id) : null, meta, fieldKey);
  }

  /** `{fieldKey: value}` → `{fieldId: cellValue}`; `undefined` values are omitted, not cleared. */
  function toCells(values: object, validations: ValidationResult[]): SdkCellValues {
    const cells: SdkCellValues = {};

    for (const [fieldKey, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const inspector = inspect(fieldKey);
      validations.push(inspector.validation);
      if (inspector.field) cells[inspector.field.id] = inspector.convertTo(value);
    }

    return cells;
  }

  /** Validate → permission-check every batch → write batch by batch. */
  async function run<T>(
    payload: (validations: ValidationResult[]) => T[],
    check: (table: SdkTable, batch: T[]) => PermissionCheck,
    write: (table: SdkTable, batch: T[]) => Promise<ReadonlyArray<string>>,
  ): Promise<MutationResult> {
    if (!table || !tableValidation.valid()) return failure(tableError(), tableValidation.issues);

    const validations: ValidationResult[] = [tableValidation];
    let items: T[];
    try {
      items = payload(validations);
    } catch (error) {
      return failure(toError(error), []);
    }

    const validation = ValidationResult.merge(validations);
    if (!validation.valid())
      return failure(new Error(validation.errors.map(i => i.message).join('\n')), validation.issues);

    const batches = chunk(items);
    try {
      for (const batch of batches) {
        const permission = check(table, batch);
        if (!permission.hasPermission) {
          const reason = permission.reasonDisplayString ?? 'no reason given';
          return failure(new Error(`Insufficient permissions on "${tableMeta.name}": ${reason}`), validation.issues);
        }
      }
    } catch (error) {
      return failure(toError(error), validation.issues);
    }

    const ids: string[] = [];
    for (let index = 0; index < batches.length; index++) {
      try {
        ids.push(...(await write(table, batches[index])));
      } catch (error) {
        return failure(toError(error), validation.issues, ids, index);
      }
    }

    return {ok: true, ids, issues: validation.issues};
  }

  function createAll(valuesList: ReadonlyArray<object>): Promise<MutationResult> {
    return run(
      validations => valuesList.map(values => ({fields: toCells(values, validations)})),
      (t, batch) => t.checkPermissionsForCreateRecords(batch),
      (t, batch) => t.createRecordsAsync(batch),
    );
  }

  function updateAll(updates: ReadonlyArray<{readonly record: RecordRef; readonly fields: object}>) {
    return run(
      validations =>
        updates
          .map(({record, fields}) => ({id: recordId(record), fields: toCells(fields, validations)}))
          // Nothing to write for this record (every value undefined).
          .filter(update => Object.keys(update.fields).length > 0),
      (t, batch) => t.checkPermissionsForUpdateRecords(batch),
      async (t, batch) => {
        await t.updateRecordsAsync(batch);
        return batch.map(update => update.id);
      },
    );
  }

  function removeAll(records: ReadonlyArray<RecordRef>) {
    return run(
      () => records.map(recordId),
      (t, batch) => t.checkPermissionsForDeleteRecords(batch),
      async (t, batch) => {
        await t.deleteRecordsAsync(batch);
        return batch;
      },
    );
  }

  function permission(check: (table: SdkTable) => PermissionCheck): PermissionCheck {
    if (!table || !tableValidation.valid()) return {hasPermission: false, reasonDisplayString: tableError().message};
    try {
      return check(table);
    } catch (error) {
      return {hasPermission: false, reasonDisplayString: toError(error).message};
    }
  }

  return {
    create: (values = {}) => createAll([values]),
    createMany: valuesList => createAll(valuesList),
    update: (record, fieldKey, value) => updateAll([{record, fields: {[fieldKey]: value}}]),
    updateFields: (record, values) => updateAll([{record, fields: values}]),
    updateMany: updates => updateAll(updates),
    remove: record => removeAll([record]),
    removeMany: records => removeAll(records),
    clone: (record, options) => createAll([cloneValues<Wt>(record, table, tableMeta, options)]),
    inspect,
    validation: tableValidation,
    can: {
      create: () => permission(t => t.checkPermissionsForCreateRecords()),
      update: () => permission(t => t.checkPermissionsForUpdateRecords()),
      delete: () => permission(t => t.checkPermissionsForDeleteRecords()),
    },
  };
}
