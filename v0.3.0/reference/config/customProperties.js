import { Table, Base } from "@airtable/blocks/interface/models";
import { SCHEMA } from "./schemaRegistry.js";
import { findTableByAliases } from "./schemaResolver.js";

/** @typedef {import("./schemaRegistry.js").SchemaTables} SchemaTables */

/**
 * Returns the custom properties configuration — table selectors only.
 * @param {Base} base
 * @returns {Array}
 */
export function getCustomProperties(base) {
   const builder = new CustomPropsTableBuilder();

   for (const tableSchema of Object.values(SCHEMA.tables)) {
      const table = findTableByAliases(base.tables, tableSchema.aliases);
      builder.push(table, tableSchema.key, tableSchema.idKey);
   }

   return builder.done();
}

/**
 * Resolves table IDs from custom properties into Table objects.
 * @param {Base} base
 * @param {Object} custoProps
 * @returns {SchemaTables}
 */
export function getCustomPropertiesTables(base, custoProps) {
   /** @type {Object<string, Table|null>} */
   const tables = {};

   for (const tableSchema of Object.values(SCHEMA.tables)) {
      const id = custoProps[tableSchema.idKey];
      tables[tableSchema.key] = id ? base.getTableByIdIfExists(/** @type {string} */ (id)) : null;
   }

   return /** @type {SchemaTables} */ (tables);
}

class CustomPropsTableBuilder {
   constructor() {
      this.props = [];
      this.valid = true;
   }

   /**
    * @param {Table|null} table
    * @param {string} key
    * @param {string} idKey
    */
   push(table, key, idKey) {
      if (!table) {
         this.props.push({
            key: idKey,
            label: `${key} Error`,
            type: "enum",
            defaultValue: "error",
            possibleValues: [{ value: "error", label: key }],
         });
         this.valid = false;
      } else {
         this.props.push({
            key: idKey,
            label: `${table.name} Table`,
            type: "enum",
            defaultValue: table.id,
            possibleValues: [{ value: table.id, label: table.name }],
         });
      }

      return this;
   }

   done() {
      return this.props;
   }
}
