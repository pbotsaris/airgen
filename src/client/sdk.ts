/**
 * Structural types for the runtime pieces of the Blocks SDK that airgen
 * touches, plus the adapter bundle each entry point fills in with the hooks
 * from its SDK flavor.
 *
 * Written structurally for the same reason as `BaseLike` in generator.ts: the
 * core modules never import SDK paths, so only the entry points (index.ts,
 * interface.ts, base.ts) care which of the SDK's ui modules exists. That is
 * what lets one build of airgen serve both the stable SDK
 * (`@airtable/blocks/ui`) and the experimental interface-alpha builds
 * (`@airtable/blocks/interface/ui`, `@airtable/blocks/base/ui`).
 */

import type {BaseLike} from './generator.js';

/**
 * The SDK Field object: a getCellValue handle plus the metadata the runtime
 * converts values by. Everything past `id` is optional so a bare handle (an
 * older adapter, a test fake) still works; the runtime falls back to the meta.
 */
export interface SdkField {
  readonly id: string;
  readonly name?: string;
  readonly type?: string;
  readonly options?: {readonly [key: string]: unknown} | null;
  readonly isComputed?: boolean;
}

export interface SdkRecord {
  readonly id: string;
  readonly name: string;
  // `any` (not SdkField) so real SDK Record classes, whose parameter is a
  // Field class union, stay assignable under strictFunctionTypes.
  getCellValue(field: any): unknown;
  getCellValueAsString(field: any): string;
}

/** The SDK's `PermissionCheckResult`, flattened. */
export interface PermissionCheck {
  readonly hasPermission: boolean;
  readonly reasonDisplayString?: string;
}

/** A cell payload keyed by field ID, as `createRecordsAsync` / `updateRecordsAsync` take it. */
export type SdkCellValues = {[fieldId: string]: unknown};

export interface SdkTable {
  readonly id: string;
  readonly name: string;
  getFieldByIdIfExists(fieldId: string): SdkField | null;
  createRecordsAsync(records: ReadonlyArray<{fields: SdkCellValues}>): Promise<ReadonlyArray<string>>;
  updateRecordsAsync(records: ReadonlyArray<{id: string; fields: SdkCellValues}>): Promise<void>;
  deleteRecordsAsync(recordIds: ReadonlyArray<string>): Promise<void>;
  checkPermissionsForCreateRecords(records?: ReadonlyArray<{fields: SdkCellValues}>): PermissionCheck;
  checkPermissionsForUpdateRecords(records?: ReadonlyArray<{id: string; fields: SdkCellValues}>): PermissionCheck;
  checkPermissionsForDeleteRecords(recordIds?: ReadonlyArray<string>): PermissionCheck;
}

export interface SdkBase {
  getTableByIdIfExists(tableId: string): SdkTable | null;
  getTableByNameIfExists(tableName: string): SdkTable | null;
}

/**
 * The hooks an entry point must supply. Method syntax throughout: methods are
 * checked bivariantly, which is what lets the SDK's more precisely typed
 * hooks (branded ids, class parameters, overloads) satisfy these shapes.
 */
export interface BlocksSdkAdapter {
  /** The returned base serves both schema reads (BaseLike) and table lookup. */
  useBase(): BaseLike & SdkBase;
  useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  useRecords(table: SdkTable): ReadonlyArray<SdkRecord> | null;
}
