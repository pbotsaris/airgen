/**
 * Table resolution: the generated table by ID, or a table picked at runtime
 * (an interface custom property) checked against the generated meta.
 *
 * Generated field IDs only hold in the base the file was generated from. A
 * duplicated base, or a builder pointing the extension at a look-alike table,
 * has the same fields under other IDs. `resolveTableOverride` finds each
 * generated field on the picked table by name, then as the primary field
 * (field IDs are unique across a base, so a generated ID can't be on another
 * table), and returns a copy of the table meta carrying the matched
 * IDs, so `useRecords`, `createMutations` and `inspectField` run on it
 * unchanged and everything downstream still resolves by ID.
 *
 * Never throws. A field with another type on the picked table blocks writes to
 * the whole table (the pick is probably the wrong table) and reads as absent,
 * so a consumer never renders a value of the wrong shape; a field the picked
 * table lacks is only a warning, and writes to that one field are refused.
 */

import type {SdkBase, SdkField, SdkTable} from '../sdk.js';
import type {AirgenFieldMeta, AirgenTableMeta} from '../useTypedRecords.js';
import {ValidationResult} from './validation.js';
import type {ValidationIssue} from './validation.js';

export interface ResolvedTable {
  /** The live table, or null when it's deleted, hidden, or nothing is picked. */
  readonly table: SdkTable | null;
  /** The generated meta, rebased onto `table`'s field IDs when it was picked at runtime. */
  readonly tableMeta: AirgenTableMeta;
  /** Table-level issues: writes are refused while this holds an error; reads carry on. */
  readonly validation: ValidationResult;
}

/** The generated table: by ID, with a name lookup as fallback. */
export function findTable(base: SdkBase, tableMeta: AirgenTableMeta): SdkTable | null {
  return base.getTableByIdIfExists(tableMeta.id) ?? base.getTableByNameIfExists(tableMeta.name);
}

/** Case- and whitespace-insensitive, like Airtable's own uniqueness check on field names. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * `table` checked against `tableMeta`. The generated table itself (same ID)
 * and a missing table pass through untouched; any other table is matched
 * field by field.
 */
export function resolveTableOverride(table: SdkTable | null, tableMeta: AirgenTableMeta): ResolvedTable {
  if (!table || table.id === tableMeta.id) return {table, tableMeta, validation: ValidationResult.ok};

  const byName = new Map<string, SdkField>();
  for (const field of table.fields) {
    if (typeof field.name === 'string') byName.set(normalizeName(field.name), field);
  }

  const issues: ValidationIssue[] = [];
  const fields: {[fieldKey: string]: AirgenFieldMeta} = {};

  for (const [fieldKey, fieldMeta] of Object.entries(tableMeta.fields)) {
    const label = fieldMeta.name ?? fieldKey;
    const live =
      byName.get(normalizeName(label)) ?? (fieldMeta.id === tableMeta.primaryFieldId ? table.primaryField : null);

    // Unmatched fields keep the generated ID, which the picked table doesn't
    // have: reads skip them and writes report `field-missing`.
    fields[fieldKey] = fieldMeta;

    if (!live) {
      issues.push({
        kind: 'field-unresolved',
        level: 'warning',
        message: `Table "${table.name}" has no field matching "${label}"; it reads as empty and can't be written.`,
        fieldKey,
      });
    } else if (live.type !== undefined && live.type !== fieldMeta.type) {
      issues.push({
        kind: 'field-incompatible',
        level: 'error',
        message: `Field "${live.name ?? label}" in table "${table.name}" is ${live.type}, but the schema expects ${fieldMeta.type}.`,
        fieldKey,
      });
    } else {
      fields[fieldKey] = {...fieldMeta, id: live.id};
    }
  }

  const rebased: AirgenTableMeta = {
    ...tableMeta,
    id: table.id,
    name: table.name,
    ...(tableMeta.primaryFieldId !== undefined && {primaryFieldId: table.primaryField.id}),
    fields,
  };

  return {table, tableMeta: rebased, validation: new ValidationResult(issues)};
}
