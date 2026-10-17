import { Table, Field } from "@airtable/blocks/interface/models";
import { FieldInspector } from "./fields.js";

/** @typedef {import("@airtable/blocks/interface/models").Record} AirtableRecord */

const BATCH_SIZE = 50;

/** @typedef {Object<string, Field|null>} FieldGroup */

/**
 * Named-field mutation API for Airtable tables.
 * Fields are referenced by their schema key (e.g. "stage", "status") rather than positional index.
 *
 * @template {FieldGroup} F
 */
export class MutableTable {
   /**
    * @param {Table} table
    * @param {F} fields - field group from config (e.g. config.fields.deal)
    */
   constructor(table, fields) {
      /** @type {Table} */
      this.table = table;

      /** @type {F} */
      this.fields = fields;
   }

   /**
    * Update a single field on one record.
    * @param {AirtableRecord} record
    * @param {keyof F} fieldKey
    * @param {any} value
    * @returns {Promise<[boolean, Error|void]>}
    */
   async update(record, fieldKey, value) {
      const converted = this.inspect(fieldKey).convertTo(value);
      return this.updateRecord(record, /** @type {any} */ ({ [fieldKey]: converted }));
   }

   /**
    * Update multiple fields on one record.
    * @param {AirtableRecord} record
    * @param {Partial<{[K in keyof F]: any}>} updates - { fieldKey: value, ... }
    * @returns {Promise<[boolean, Error|void]>}
    */
   async updateRecord(record, updates) {
      try {
         const params = this._buildParams(updates);
         if (params === null) {
            return [false, new Error("One or more fields could not be resolved (null field)")];
         }

         if (Object.keys(params).length === 0) return [true, undefined];

         const result = this.table.checkPermissionsForUpdateRecord(record, params);
         if (!result.hasPermission) {
            /* @ts-ignore */
            const reason = result.reasonDisplayString || "unknown reason";
            return [false, new Error(`Insufficient permissions to update the record: ${reason}`)];
         }

         return [true, await this.table.updateRecordAsync(record, params)];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Update a single field on multiple records (batched in groups of 50).
    * @param {AirtableRecord[]} records
    * @param {keyof F} fieldKey
    * @param {any} value
    * @returns {Promise<[boolean, Error|void]>}
    */
   async updateAll(records, fieldKey, value) {
      return this.updateRecords(records, /** @type {any} */ ({ [fieldKey]: value }));
   }

   /**
    * Update multiple fields on multiple records (batched in groups of 50).
    * @param {AirtableRecord[]} records
    * @param {Partial<{[K in keyof F]: any}>} updates - { fieldKey: value, ... }
    * @returns {Promise<[boolean, Error|void]>}
    */
   async updateRecords(records, updates) {
      try {
         const params = this._buildParams(updates);
         if (params === null) {
            return [false, new Error("One or more fields could not be resolved (null field)")];
         }

         if (Object.keys(params).length === 0) return [true, undefined];

         for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const batchUpdates = batch.map((record) => ({ id: record.id, fields: params }));

            const result = this.table.checkPermissionsForUpdateRecords(batchUpdates);
            if (!result.hasPermission) {
               /* @ts-ignore */
               const reason = result.reasonDisplayString || "unknown reason";
               return [false, new Error(`Insufficient permissions to update records: ${reason}`)];
            }

            await this.table.updateRecordsAsync(batchUpdates);
         }

         return [true, undefined];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Update different fields/values on each of several records (batched in groups of 50).
    * The per-record twin of `updateRecords`: each entry carries its own `{ fieldKey: value }`.
    *
    * Values are written as given (no `convertTo`). Fails as a whole, before any write, if an
    * entry names a field that never resolved.
    *
    * @param {{record: AirtableRecord, updates: Partial<{[K in keyof F]: any}>}[]} entries
    * @returns {Promise<[boolean, Error|void]>}
    */
   async updateEach(entries) {
      try {
         /** @type {{id: string, fields: Object<string, any>}[]} */
         const all = [];
         for (const { record, updates } of entries) {
            const params = this._buildParams(updates);
            if (params === null) {
               return [false, new Error("One or more fields could not be resolved (null field)")];
            }
            if (Object.keys(params).length > 0) all.push({ id: record.id, fields: params });
         }

         for (let i = 0; i < all.length; i += BATCH_SIZE) {
            const batch = all.slice(i, i + BATCH_SIZE);

            const result = this.table.checkPermissionsForUpdateRecords(batch);
            if (!result.hasPermission) {
               /* @ts-ignore */
               const reason = result.reasonDisplayString || "unknown reason";
               return [false, new Error(`Insufficient permissions to update records: ${reason}`)];
            }

            await this.table.updateRecordsAsync(batch);
         }

         return [true, undefined];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Create one record.
    *
    * Unlike `update`, values are written as given — pass them in the shape the field expects
    * (`inspect(key).convertTo(value)` if it needs converting). An empty `values` creates a
    * blank record, which is the usual way to add a row the user then fills in.
    *
    * @param {Partial<{[K in keyof F]: any}>} [values] - { fieldKey: value, ... }
    * @returns {Promise<[boolean, string|Error]>} the new record's id on success
    */
   async create(values = {}) {
      try {
         const params = this._buildParams(values);
         if (params === null) {
            return [false, new Error("One or more fields could not be resolved (null field)")];
         }

         const result = this.table.checkPermissionsForCreateRecord(params);
         if (!result.hasPermission) {
            /* @ts-ignore */
            const reason = result.reasonDisplayString || "unknown reason";
            return [false, new Error(`Insufficient permissions to create the record: ${reason}`)];
         }

         return [true, await this.table.createRecordAsync(params)];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Create multiple records, all with the same values (batched in groups of 50).
    *
    * @param {number} count
    * @param {Partial<{[K in keyof F]: any}>} [values] - { fieldKey: value, ... }
    * @returns {Promise<[boolean, string[]|Error]>} the new records' ids on success
    */
   async createAll(count, values = {}) {
      try {
         const params = this._buildParams(values);
         if (params === null) {
            return [false, new Error("One or more fields could not be resolved (null field)")];
         }

         /** @type {string[]} */
         const ids = [];

         for (let i = 0; i < count; i += BATCH_SIZE) {
            const batch = Array.from({ length: Math.min(BATCH_SIZE, count - i) }, () => ({ fields: params }));

            const result = this.table.checkPermissionsForCreateRecords(batch);
            if (!result.hasPermission) {
               /* @ts-ignore */
               const reason = result.reasonDisplayString || "unknown reason";
               return [false, new Error(`Insufficient permissions to create records: ${reason}`)];
            }

            ids.push(...(await this.table.createRecordsAsync(batch)));
         }

         return [true, ids];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Create several records, each with its own values (batched in groups of 50). The
    * per-record twin of `createAll`, as `updateEach` is of `updateRecords`.
    *
    * Values are written as given (no `convertTo`). Fails as a whole, before any write, if an
    * entry names a field that never resolved. Returns the new ids in the order given.
    *
    * @param {Partial<{[K in keyof F]: any}>[]} valuesList - one `{ fieldKey: value, ... }` per record
    * @returns {Promise<[boolean, string[]|Error]>} the new records' ids on success
    */
   async createEach(valuesList) {
      try {
         /** @type {{fields: Object<string, any>}[]} */
         const all = [];
         for (const values of valuesList) {
            const params = this._buildParams(values);
            if (params === null) {
               return [false, new Error("One or more fields could not be resolved (null field)")];
            }
            all.push({ fields: params });
         }

         /** @type {string[]} */
         const ids = [];

         for (let i = 0; i < all.length; i += BATCH_SIZE) {
            const batch = all.slice(i, i + BATCH_SIZE);

            const result = this.table.checkPermissionsForCreateRecords(batch);
            if (!result.hasPermission) {
               /* @ts-ignore */
               const reason = result.reasonDisplayString || "unknown reason";
               return [false, new Error(`Insufficient permissions to create records: ${reason}`)];
            }

            ids.push(...(await this.table.createRecordsAsync(batch)));
         }

         return [true, ids];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Delete one record. Takes the record or just its id — useful for rolling back a create,
    * where only the id is in hand.
    *
    * @param {AirtableRecord|string} record
    * @returns {Promise<[boolean, Error|void]>}
    */
   async delete(record) {
      try {
         const result = this.table.checkPermissionsForDeleteRecord(record);
         if (!result.hasPermission) {
            /* @ts-ignore */
            const reason = result.reasonDisplayString || "unknown reason";
            return [false, new Error(`Insufficient permissions to delete the record: ${reason}`)];
         }

         return [true, await this.table.deleteRecordAsync(record)];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * Delete multiple records (batched in groups of 50). Takes records or just their ids, as
    * `delete` does — rolling back a batch create only has ids in hand.
    * @param {(AirtableRecord|string)[]} records
    * @returns {Promise<[boolean, Error|void]>}
    */
   async deleteAll(records) {
      try {
         for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            const result = this.table.checkPermissionsForDeleteRecords(batch);
            if (!result.hasPermission) {
               /* @ts-ignore */
               const reason = result.reasonDisplayString || "unknown reason";
               return [false, new Error(`Insufficient permissions to delete records: ${reason}`)];
            }

            await this.table.deleteRecordsAsync(batch);
         }

         return [true, undefined];
      } catch (error) {
         return [false, error];
      }
   }

   /**
    * @param {keyof F} fieldKey
    * Returns a FieldInspector for the given field key.
    * @returns {FieldInspector}
    */
   inspect(fieldKey) {
      return FieldInspector.for(this.fields[fieldKey] || null);
   }

   /**
    * Maps { fieldKey: value } → { field.id: value }.
    * Returns null if any referenced field is null (unresolved).
    * @private
    * @param {Object<string, any>} updates
    * @returns {Object<string, any>|null}
    */
   _buildParams(updates) {
      const params = {};
      for (const [key, value] of Object.entries(updates)) {
         const field = this.fields[key];
         if (!field) return null;
         params[field.id] = value;
      }
      return params;
   }
}
