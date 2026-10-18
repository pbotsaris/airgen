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
  readonly primaryField: SdkField;
  readonly fields: ReadonlyArray<SdkField>;
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
 * A table-picker custom property, the one kind of custom property airgen
 * registers. Mirrors the `type: 'table'` member of the interface SDK's
 * `BlockPageElementCustomProperty`; the SDK hands the picked table back as
 * the property's value (or `defaultValue` when nothing valid is picked).
 */
export interface TableCustomProperty {
  key: string;
  label: string;
  type: 'table';
  defaultValue?: any;
}

/**
 * The hooks an entry point must supply. Method syntax throughout: methods are
 * checked bivariantly, which is what lets the SDK's more precisely typed
 * hooks (branded ids, class parameters, overloads) satisfy these shapes.
 */
/**
 * Wraps an SDK `useRecords` that can't take `null` so the adapter contract
 * holds: for a missing table it loads any table of the base instead (the SDK
 * pools record stores per table, so the stand-in costs nothing) and returns
 * `null`. The SDK hook is always called, so React sees the same hooks whether
 * or not the table exists. Only when the base exposes no table at all is the
 * call skipped — there is nothing to render in that state anyway.
 */
export function nullSafeUseRecords<T extends SdkTable, R>(
  useBase: () => {readonly tables: ReadonlyArray<unknown>},
  useRecords: (table: T) => R,
): (table: T | null) => R | null {
  return table => {
    const standIn = table ?? (useBase().tables[0] as T | undefined) ?? null;
    const records = standIn ? useRecords(standIn) : null;
    return table ? records : null;
  };
}

export interface BlocksSdkAdapter {
  /** The returned base serves both schema reads (BaseLike) and table lookup. */
  useBase(): BaseLike & SdkBase;
  useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  /**
   * Must accept `null` (a deleted or hidden table) and return `null` for it
   * without throwing — and still call the SDK's hook, so the hook count stays
   * fixed. The stable SDK does this itself; the interface SDK's `useRecords`
   * reads `table.id` unguarded, so `interface.ts` wraps it with
   * `nullSafeUseRecords`.
   */
  useRecords(table: SdkTable | null): ReadonlyArray<SdkRecord> | null;
  /**
   * React's `useMemo`. Optional so a test adapter of plain functions needs no
   * React render; without it every hook result is rebuilt on each call.
   */
  useMemo?<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;
  /**
   * Airtable's light/dark theme, which the observer picks its palette from.
   * Optional: the stable SDK only has it from 1.19, so each entry reads it
   * off the module namespace and leaves it undefined on older builds.
   */
  useColorScheme?(): {colorScheme: 'light' | 'dark'};
  /**
   * Interface SDK only; undefined on the stable and base flavors, where
   * `customProperties` overrides fall back to the generated tables with a
   * warning. `getDefinitions` must keep one identity across renders.
   */
  useCustomProperties?(getDefinitions: (base: any) => Array<TableCustomProperty>): {
    customPropertyValueByKey: {[key: string]: unknown};
  };
}
