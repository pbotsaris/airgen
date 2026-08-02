/**
 * Typed record hooks runtime.
 *
 * Consumers don't call this directly: the generated `airtable-schema.ts` ends
 * with
 *
 *   export const {useRecords, useTable} = createTypedHooks<TableRecordMap>(airgenMeta);
 *
 * so the whole consumer-facing API is `import {useRecords} from
 * './airtable-schema'`. That works from plain JS too — the generic is bound
 * inside the generated file, so the editor infers table keys and field types
 * at any call site without annotations.
 *
 * Everything resolves by ID (table id, field id) so renames in Airtable never
 * break a running extension — re-running the generator only refreshes the
 * display names baked into the types.
 *
 * SDK hooks arrive via `BlocksSdkAdapter` from the entry point rather than an
 * import, so this module compiles against every SDK flavor (see sdk.ts).
 */

import type {BlocksSdkAdapter, SdkBase, SdkRecord, SdkTable} from './sdk.js';

export interface AirgenFieldMeta {
  readonly id: string;
  /** Raw Airtable field name (the map key is the sanitized property name). Optional: older generated files lack it. */
  readonly name?: string;
  readonly type: string;
  readonly choices?: {readonly [choiceName: string]: string};
}

export interface AirgenTableMeta {
  readonly id: string;
  readonly name: string;
  readonly fields: {readonly [fieldName: string]: AirgenFieldMeta};
}

export interface AirgenMeta<M> {
  readonly baseId: string;
  readonly signature: string;
  readonly generatedAt: string;
  readonly tables: {readonly [K in keyof M]: AirgenTableMeta};
}

export interface Record<M, K extends keyof M> {
  id: string;
  fields: Partial<M[K]>;
  /** Escape hatch to the native SDK record (cast to your SDK's Record type). */
  raw: SdkRecord;
}

function resolveTable(base: SdkBase, tableMeta: AirgenTableMeta | undefined): SdkTable | null {
  if (!tableMeta) return null;
  return base.getTableByIdIfExists(tableMeta.id) ?? base.getTableByNameIfExists(tableMeta.name);
}

/** Binds an SDK flavor's hooks; each entry point exports the result as `createTypedHooks`. */
export function makeCreateTypedHooks(sdk: BlocksSdkAdapter) {
  return function createTypedHooks<M extends object>(meta: AirgenMeta<M>) {
    /** Resolves the SDK Table for a generated table key (by ID, name fallback). */
    function useTable<K extends keyof M & string>(tableKey: K): SdkTable | null {
      const base = sdk.useBase();
      return resolveTable(base, meta.tables[tableKey]);
    }

    function useRecords<K extends keyof M & string>(tableKey: K): Array<Record<M, K>> {
      const base = sdk.useBase();
      const tableMeta = meta.tables[tableKey];
      const table = resolveTable(base, tableMeta);
      // The SDK's useRecords accepts null (and returns null), but its
      // overloads don't admit `SdkTable | null` directly.
      const records = sdk.useRecords(table as SdkTable);

      if (!table || !records) return [];

      return records.map(record => {
        const fields: {[fieldName: string]: unknown} = {};

        for (const [fieldName, fieldMeta] of Object.entries(tableMeta.fields)) {
          const field = table.getFieldByIdIfExists(fieldMeta.id);

          if (!field) continue; // deleted (or hidden from this extension) since generation

          const value = record.getCellValue(field);

          if (value !== null && value !== undefined) {
            fields[fieldName] = value;
          }

        }

        return {id: record.id, fields: fields as Partial<M[K]>, raw: record};
      });
    }

    return {useTable, useRecords};
  };
}
