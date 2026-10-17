import { useRecords } from "@airtable/blocks/interface/ui";
import { useConfig } from "./useConfig";
import normalize from "../airtable/normalize.js";
import { Record } from "@airtable/blocks/interface/models";

/** @typedef {Object} ScenarioInfo
 * @property {string} id
 * @property {string} name
 * @property {number} total
 * @property {number} subtotal
 * @property {number} discount
 * @property {string[]} licenseTermItemIds - ids of the scenario's License Term Items, in link order
 * @property {string[]} itemIds - ids of the scenario's Scenario Service Items, in link order
 * @property {boolean} isApproved
 * @property {number} order
 * @property {string} description
 * @property {boolean} showDescription - whether to show the description field in the UI, which can be toggled by the user
 * @property {Record} record - the original Airtable record for the scenario, which can be used for updates or reference
 */

/** @param {import("./useEstimateInfo").EstimateInfo} estimateInfo
 * @return {ScenarioInfo[]}
 **/
export function useEstimateScenarios(estimateInfo) {
   const { config } = useConfig();
   const { scenarios } = config.tables;
   const scenarioFields = config.fields.scenario;

   const scenarioIds = estimateInfo.scenarioIds;
   const scenarioRecords = useRecords(scenarios)?.filter((r) => scenarioIds.includes(r.id));

   if (!scenarioRecords) return [];

   return /** @type {ScenarioInfo[]} */ (
      scenarioRecords
         .map((r) => {
            const total = normalize.getCellValue(r, scenarioFields.total);
            const subTotal = normalize.getCellValue(r, scenarioFields.subTotal);
            const discount = normalize.getCellValue(r, scenarioFields.discount);
            const licenseTermItemIds = normalize.listLinkRecordIds(
               normalize.getCellValue(r, scenarioFields.licenseTermItems),
            );
            const itemIds = normalize.listLinkRecordIds(normalize.getCellValue(r, scenarioFields.items));
            const isApproved = normalize.getCellValue(r, scenarioFields.isApproved) || false;
            const order = normalize.getCellValue(r, scenarioFields.order) || 0;
            const description = normalize.getCellValue(r, scenarioFields.description) || "";
            const showDescription = normalize.getCellValue(r, scenarioFields.showDescription) || false;

            return {
               id: r.id,
               name: r.name,
               total: /**@type {number} */ (total),
               subtotal: /**@type {number} */ (subTotal),
               discount: /**@type {number} */ (discount),
               licenseTermItemIds,
               itemIds,
               isApproved: /** @type {boolean} */ (isApproved),
               order: /** @type {number} */ (order),
               description: /** @type {string} */ (description),
               showDescription: /** @type {boolean} */ (showDescription),
               record: r,
            };
         })
         .sort((a, b) => a.order - b.order)
   );
}

