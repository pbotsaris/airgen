import { FieldType } from "@airtable/blocks/interface/models";
import normalize from "./normalize.js";

/**
 * Copy the writable cells of a record into a values object `MutableTable.create` accepts.
 *
 * Generic: it iterates the keys of a resolved schema field group (`config.fields.<group>`),
 * so only fields the app knows about are copied, and cells are reshaped from what a read
 * returns to what a write expects (`{id, name, color}` → `{id}`, links → `[{id}]`).
 */

/** @typedef {import('@airtable/blocks/interface/models').Field} Field */
/** @typedef {import('@airtable/blocks/interface/models').Record} AirtableRecord */

/**
 * Field types a write can never target. `Field.isComputed` covers the same ground on a
 * real field; the set is the fallback for when that flag is unavailable (test stubs).
 *
 * Attachments are excluded deliberately: copying them means re-uploading by URL, which
 * is a different feature.
 */
export const NON_WRITABLE_TYPES = new Set([
   FieldType.FORMULA,
   FieldType.ROLLUP,
   FieldType.COUNT,
   FieldType.MULTIPLE_LOOKUP_VALUES,
   FieldType.CREATED_TIME,
   FieldType.LAST_MODIFIED_TIME,
   FieldType.CREATED_BY,
   FieldType.LAST_MODIFIED_BY,
   FieldType.AUTO_NUMBER,
   FieldType.BUTTON,
   FieldType.EXTERNAL_SYNC_SOURCE,
   FieldType.AI_TEXT,
   FieldType.MULTIPLE_ATTACHMENTS,
]);

const SINGLE_OBJECT_TYPES = new Set([FieldType.SINGLE_SELECT, FieldType.SINGLE_COLLABORATOR]);
const MULTI_OBJECT_TYPES = new Set([
   FieldType.MULTIPLE_SELECTS,
   FieldType.MULTIPLE_COLLABORATORS,
   FieldType.MULTIPLE_RECORD_LINKS,
]);

/**
 * Whether a value can be written to `field`. Null (unresolved) fields are not writable.
 *
 * @param {Field | null | undefined} field
 * @returns {boolean}
 */
export function isWritableField(field) {
   if (!field) return false;
   if (/** @type {any} */ (field).isComputed === true) return false;
   return !NON_WRITABLE_TYPES.has(field.type);
}

/**
 * Reshape a cell value as read into the shape a write expects for `field`'s type.
 *
 * - empty → `undefined` (the caller omits the key)
 * - single select / collaborator: `{id, name, ...}` → `{id}`
 * - multiple selects / collaborators / record links: `[{id, name, ...}]` → `[{id}]`
 * - everything else is written as read (numbers, percent fractions, text, dates, checkboxes)
 *
 * @param {Field} field
 * @param {any} value
 * @returns {any}
 */
export function toWritableValue(field, value) {
   if (value === null || value === undefined) return undefined;

   if (SINGLE_OBJECT_TYPES.has(field.type)) {
      return typeof value === "object" && value.id ? { id: value.id } : undefined;
   }

   if (MULTI_OBJECT_TYPES.has(field.type)) {
      if (!Array.isArray(value)) return undefined;
      const ids = value.filter((v) => v && typeof v === "object" && v.id).map((v) => ({ id: v.id }));
      return ids.length > 0 ? ids : undefined;
   }

   return value;
}

/**
 * The writable cells of `record`, keyed by the field-group keys of `fields`, ready for
 * `MutableTable.create`.
 *
 * Skips keys whose field did not resolve, computed fields, empty cells and `omit` keys.
 * `overrides` win over copied values, but are also dropped when their field did not
 * resolve — `MutableTable` fails the whole write if any key maps to a null field.
 *
 * @template {Object<string, Field | null>} F
 * @param {AirtableRecord} record
 * @param {F} fields
 * @param {{ omit?: (keyof F)[], overrides?: Partial<Record<keyof F, any>> }} [options]
 * @returns {Partial<Record<keyof F, any>>}
 */
export function cloneValues(record, fields, { omit = [], overrides = {} } = {}) {
   const omitted = new Set(omit);
   /** @type {Partial<Record<keyof F, any>>} */
   const values = {};

   for (const key of /** @type {(keyof F)[]} */ (Object.keys(fields))) {
      const field = fields[key];
      if (omitted.has(key) || !isWritableField(field)) continue;

      const value = toWritableValue(/** @type {Field} */ (field), normalize.getCellValue(record, field));
      if (value !== undefined) values[key] = value;
   }

   for (const key of /** @type {(keyof F)[]} */ (Object.keys(overrides))) {
      const value = overrides[key];
      if (value === undefined || !fields[key]) continue;
      values[key] = value;
   }

   return values;
}
