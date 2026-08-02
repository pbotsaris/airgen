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

/** The SDK Field object, as far as airgen needs it: a getCellValue handle. */
export interface SdkField {
  readonly id: string;
}

export interface SdkRecord {
  readonly id: string;
  readonly name: string;
  // `any` (not SdkField) so real SDK Record classes, whose parameter is a
  // Field class union, stay assignable under strictFunctionTypes.
  getCellValue(field: any): unknown;
}

export interface SdkTable {
  readonly id: string;
  readonly name: string;
  getFieldByIdIfExists(fieldId: string): SdkField | null;
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
