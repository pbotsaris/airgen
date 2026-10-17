import { useRecords } from "@airtable/blocks/interface/ui";
import { useConfig } from "./useConfig.js";
import normalize from "../airtable/normalize.js";
import { Record } from "@airtable/blocks/interface/models";

/** @typedef {import("../config/schemaRegistry.js").ServiceFields} ServiceFields */

/**
 * A row of the Services table — the catalog users maintain. A Service is the
 * *template* a ServiceItem is created from; see useServiceItems.js
 * for the line items themselves.
 *
 * @typedef {Object} ServiceInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} value
 * @property {string} currency
 * @property {string} type
 * @property {Record} record
 */

/**
 * Maps a Services record to ServiceInfo. Shared with useServiceItems, which
 * resolves the service linked to each line item.
 *
 * @param {Record} record
 * @param {ServiceFields} serviceFields
 * @returns {ServiceInfo}
 */
export function toServiceInfo(record, serviceFields) {
   return {
      id: record.id,
      name: record.name,
      description: normalize.getCellValueAsString(record, serviceFields.description) || "",
      value: normalize.getCellValueAsString(record, serviceFields.value) || "",
      currency: normalize.getCellValueAsString(record, serviceFields.currency) || "",
      type: normalize.getCellValueAsString(record, serviceFields.type) || "",
      record,
   };
}

/**
 * Looks up one service in the Services catalog.
 *
 * @param {string | null | undefined} serviceId
 * @returns {ServiceInfo | null}
 */
export function useService(serviceId) {
   const { config, validation } = useConfig();
   const { services } = config.tables;
   const serviceFields = config.fields.service;

   const serviceRecords = useRecords(services);

   if (!serviceId) return null;

   if (!validation.valid()) {
      console.warn("useService: Invalid configuration.", validation.toJSON());
      return null;
   }

   const serviceRecord = serviceRecords?.find((r) => r.id === serviceId);

   if (!serviceRecord) {
      console.warn(`useService: No service found with id '${serviceId}'.`);
      return null;
   }

   return toServiceInfo(serviceRecord, serviceFields);
}
