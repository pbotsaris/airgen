import { useRecords } from "@airtable/blocks/interface/ui";
import { useConfig } from "../hooks/useConfig.js";

import { Table, Record } from "@airtable/blocks/interface/models";

import normalize from "../airtable/normalize.js";
import "../airtable/airtableTypes.js";

/** @typedef {import("../config/schemaRegistry.js").StudioFields} StudioFields */

/** @typedef {Object} AddressLines
 * @property {string} one
 * @property {string} two
 * @property {string} three
 */

/** @typedef {Object} StudioInfo
 * @property {string} id
 * @property {string} name
 * @property {AddressLines} addressLines
 * @property {SingleSelectValue | null} country
 * @property {string} registration
 * @property {string} phone
 */

/** @exports {StudioInfo} */

/** @param {Record | string} StudioRecordOrId
 *  @returns {StudioInfo | null}
 */


/** @typedef {import("../config/configResolver.js").ResolvedConfig} ResolvedConfig */
   
export function useStudio(StudioRecordOrId) {
   if (!StudioRecordOrId) return null;

   const { config, validation } = useConfig();

   if (!validation.valid()) {
      console.warn(
         "useStudio: Invalid configuration. Please ensure the custom properties are set up correctly.",
         validation.toJSON(),
      );
      return null;
   }

   const { studio: studioFields } = config.fields;

   const studioRecord = typeof StudioRecordOrId === "string" ? findStudioById(StudioRecordOrId, config) : StudioRecordOrId;

   if (!studioRecord) return null;

   const country = normalize.getSingleSelectValue(normalize.getCellValue(studioRecord, studioFields.country));

   return {
      id: studioRecord.id,
      name: studioRecord.name,
      addressLines: {
         two: normalize.getCellValueAsString(studioRecord, studioFields.addressLine2) || "",
         one: normalize.getCellValueAsString(studioRecord, studioFields.addressLine1) || "",
         three: normalize.getCellValueAsString(studioRecord, studioFields.addressLine3) || "",
      },
      country: country,
      registration: normalize.getCellValueAsString(studioRecord, studioFields.registration) || "",
      phone: normalize.getCellValueAsString(studioRecord, studioFields.phone) || "",
   };
}

/** @param {string} studioId
   * @param {ResolvedConfig} config
 * @returns {Record | null}
 * */
function findStudioById(studioId, config) {
   const { studios: studioTable } = config.tables;

   throwInvalidTable(studioTable);

   const studioRecords = useRecords(studioTable);

   if (!studioRecords) return null;

   const studioRecord = studioRecords.find((record) => record.id === studioId);

   if (!studioRecord) {
      console.warn(`useStudio: No studio found with id '${studioId}'.`);
      return null;
   }

   return studioRecord;
}

/** @param {Table} table */
function throwInvalidTable(table) {
   if (!table)
      throw new Error("useStudio: 'studios' table not found. Please ensure the custom properties are set up correctly.");

   if (!(table instanceof Table)) {
      throw new Error(
         "useStudio: 'studios' is not a Table instance. Please ensure the custom properties are set up correctly.",
      );
   }

   if (invalidTableName(table.name)) {
      throw new Error(
         `useStudio: Expected 'studios', 'studio', 'estúdio' or 'estudio' for the studio table table but got '${table.name}'. Please ensure the custom properties are set up correctly.`,
      );
   }
}

/** @param {string} tableName */
function invalidTableName(tableName) {
   return (
      !tableName.toLowerCase().includes("studio") &&
      !tableName.toLowerCase().includes("estudio") &&
      !tableName.toLowerCase().includes("estúdio")
   );
}
