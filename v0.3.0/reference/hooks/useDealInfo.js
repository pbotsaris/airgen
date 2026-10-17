import { useConfig } from "./useConfig.js";
import "../airtable/airtableTypes.js"

// Selects based on the Estimating To field in Deals.
// TODO: Make this more rubust by using ids of the single select fields
const AGENCY = "Agency";
const CLIENT = "Client";

import normalize from "../airtable/normalize.js";
/** @typedef {Object} DealInfo

 * @property {LinkedRecordValue} client
 * @property {LinkedRecordValue} contact
 * @property {LinkedRecordValue} agency
 * @property {LinkedRecordValue} stage
 * @property {OwnerValue} owner
 * @property {string} currencySymbol
 * @property {string} totalBudget
 * @property {string} weightedBudget
 * @property {string} prob
 * @property {string} position
 * @property {SingleSelectValue | null} status
 * @property {SingleSelectValue | null} lostReason
 * @property {string} lostReasonDetails
 * @property {SingleSelectValue | null} estimatingTo
 * @property {() => string | null} getEstimateOrganizationId
 *
 *
 */

/** @param {import("@airtable/blocks/interface/models").Record} record
 * @returns {DealInfo} */
export function useDealInfo(record) {
   const { config } = useConfig();

  const fields = config.fields;
  return useDealInfoFromFields(record, fields);
}

/** @param {import("@airtable/blocks/interface/models").Record} record
 * @param {import("../config/schemaRegistry.js").ResolvedFields} fields
 * @returns {DealInfo}
 **/
export function useDealInfoFromFields(record, fields) {
  const { deal: dealFields } = fields;

  const client = normalize.getLinkRecord(normalize.getCellValue(record, dealFields.client));
  const contact = normalize.getLinkRecord(normalize.getCellValue(record, dealFields.contact));
  const agency = normalize.getLinkRecord(normalize.getCellValue(record, dealFields.agency));
  const owner = normalize.getUserRecord(normalize.getCellValue(record, dealFields.owner));
  const stage = normalize.getLinkRecord(normalize.getCellValue(record, dealFields.stage));
  const position = normalize.getCellValueAsString(record, dealFields.position);
  const status = normalize.getSingleSelectValue(normalize.getCellValue(record, dealFields.status));
  const lostReason = normalize.getSingleSelectValue(normalize.getCellValue(record, dealFields.lostReason));
  const lostReasonDetails = normalize.getCellValueAsString(record, dealFields.lostReasonDetail);
  const estimatingTo = normalize.getSingleSelectValue(normalize.getCellValue(record, dealFields.estimatingTo));

  return {
    client: client || { id: "", name: "" },
    contact: contact || { id: "", name: "" },
    owner: owner || { id: "", name: "", email: "", permissionLevel: "", profilePicUrl: "" },
    agency: agency || { id: "", name: "" },
    currencySymbol: normalize.getCellValueAsString(record, dealFields.currencySymbol),
    totalBudget: normalize.getCellValueAsString(record, dealFields.totalBudget),
    weightedBudget: normalize.getCellValueAsString(record, dealFields.weightedBudget),
    prob: normalize.getCellValueAsString(record, dealFields.prob),
    position: position,
    status: status, 
    stage: stage ,
    lostReason: lostReason ,
    lostReasonDetails: lostReasonDetails,
    estimatingTo: estimatingTo,
    getEstimateOrganizationId() {
      if (this.estimatingTo?.name === CLIENT && this.client) return this.client?.id;
      if (this.estimatingTo?.name === AGENCY && this.agency) return this.agency?.id;
    },
  };
}
