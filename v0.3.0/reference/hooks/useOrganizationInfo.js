import { useConfig } from "./useConfig";
import normalize from "../airtable/normalize.js";

import { Record } from "@airtable/blocks/interface/models";
import { useRecords } from "@airtable/blocks/interface/ui";

/** @typedef {Object} OrganizationInfo
 * @property {string} id
 * @property {string} name
 * @property {{one: string, two: string, three: string}} addressLines
 * @property {string} phone
 * @property {string} taxId
 * @property {string} country
 */

/** @typedef {import("../config/configResolver.js").ResolvedConfig} ResolvedConfig

/** @exports OrganizationInfo */

/** @param {Record | string} recordOrId
 * @returns {OrganizationInfo}
 */
export function useOrganizationInfo(recordOrId) {
   const { config, validation } = useConfig();

   if(!validation.valid()) {
      console.warn("useOrganizationInfo called with invalid config:", validation.toJSON());
      return null;
   }

   if (recordOrId == null) {
      console.warn("useOrganizationInfo called with null or undefined recordOrId");
      return null;
   }
   if (recordOrId instanceof Record) return getOrganizationInfoFromRecord(recordOrId, config);

   if (typeof recordOrId !== "string") {
      console.warn("useOrganizationInfo called with invalid recordOrId type:", typeof recordOrId);
      return null;
   }


   const { organizations: orgTable } = config.tables;
   const records = useRecords(orgTable);

   return getOrganizationInfoFromRecord(
      records.find((r) => r.id === recordOrId),
      config,
   );
}

/** @param {Record} record
 * @param {ResolvedConfig} config
 * @returns {OrganizationInfo}
 */
function getOrganizationInfoFromRecord(record, config) {
   if (!record) return null;

   const { organization: fields } = config.fields;

   const addressLines = {
      one: normalize.getCellValueAsString(record, fields.addressLine1),
      two: normalize.getCellValueAsString(record, fields.addressLine2),
      three: normalize.getCellValueAsString(record, fields.addressLine3),
   };

   return {
      id: record.id,
      name: normalize.getCellValueAsString(record, fields.name),
      addressLines: addressLines,
      phone: normalize.getCellValueAsString(record, fields.phone),
      taxId: normalize.getCellValueAsString(record, fields.taxId),
      country: normalize.getCellValueAsString(record, fields.country),
   };
}
