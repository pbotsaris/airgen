/**
 * Interface Designer table pickers: one `table` custom property per table key
 * listed in `createTypedHooks(meta, {customProperties})`, defaulting to the
 * generated table, so a builder can point the extension at another table
 * (a duplicated base, a look-alike table) without a code change. The pick is
 * checked against the generated meta by `resolveTableOverride` (resolver.ts).
 *
 * Interface SDK only. The definitions are plain data here; the entry point's
 * adapter supplies `useCustomProperties`, and flavors without it fall back to
 * the generated tables.
 */

import type {SdkBase, SdkTable, TableCustomProperty} from '../sdk.js';
import type {AirgenTableMeta} from '../useTypedRecords.js';
import {findTable} from './resolver.js';

/** Table key → label shown in the Interface Designer properties panel. */
export type CustomPropertiesConfig<M> = {readonly [K in keyof M & string]?: string};

/**
 * The custom property (and global config) key for a table. Keyed by the
 * generated table ID rather than the table key, so renaming the table in
 * Airtable (which renames the key on regeneration) keeps the builder's pick.
 */
export function customPropertyKey(tableMeta: AirgenTableMeta): string {
  return `airgenTable_${tableMeta.id}`;
}

/** One table picker per configured table key the meta knows, in config order. */
export function tableCustomProperties(
  base: SdkBase,
  tables: {readonly [tableKey: string]: AirgenTableMeta},
  config: {readonly [tableKey: string]: string | undefined},
): TableCustomProperty[] {
  const properties: TableCustomProperty[] = [];

  for (const [tableKey, label] of Object.entries(config)) {
    const tableMeta = tables[tableKey];
    if (!tableMeta || label === undefined) continue;

    const generated = findTable(base, tableMeta);
    properties.push({
      key: customPropertyKey(tableMeta),
      label,
      type: 'table',
      ...(generated && {defaultValue: generated}),
    });
  }

  return properties;
}

function isTable(value: unknown): value is SdkTable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SdkTable).id === 'string' &&
    typeof (value as SdkTable).getFieldByIdIfExists === 'function'
  );
}

/** The table picked for `tableMeta`, or null when nothing (valid) is picked and there's no default. */
export function pickedTable(values: {readonly [key: string]: unknown}, tableMeta: AirgenTableMeta): SdkTable | null {
  const value = values[customPropertyKey(tableMeta)];
  return isTable(value) ? value : null;
}
