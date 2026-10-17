import { useConfig } from "../hooks/useConfig.js";
import { useStudio } from "../hooks/useStudio.js";
import { useEstimateInfo } from "../hooks/useEstimateInfo.js";
import { useDealInfo } from "../hooks/useDealInfo.js";
import { useOrganizationInfo } from "../hooks/useOrganizationInfo.js";

import { Record } from "@airtable/blocks/interface/models";
import { useRecords } from "@airtable/blocks/interface/ui";
import { useTableMutations } from "./useTableMutations.js";
import { useToast } from "../context/ToastContext.jsx";

/** @typedef {import("./useStudio").StudioInfo} StudioInfo
 * @typedef {import("./useDealInfo").DealInfo} DealInfo
 * @typedef {import("./useOrganizationInfo").OrganizationInfo} OrganizationInfo
 * @typedef {import("./useEstimateInfo").EstimateInfo} EstimateInfo
 *
 * @typedef {import("../config/schemaRegistry.js").EstimateFields} EstimateFields
 * @typedef {import("../config/schemaRegistry.js").DealFields} DealFields
 *
 * @typedef {Object} EstimateEditorInfo
 * @property {StudioInfo} studio
 * @property {OrganizationInfo} organization
 * @property {EstimateInfo} estimate
 * @property {DealInfo} deal
 *
 * @typedef {Object} EstimateUpdateMap
 * @property {Partial<{[K in keyof EstimateFields]: any}>} [estimate]
 * @property {Partial<{[K in keyof DealFields]: any}>} [deal]
 **/

/** @param {Record} estimate
 * @param {Record} deal */
export function useEstimateEditor(estimate, deal) {
   const {config} = useConfig();
   const { error: toastError, toast } = useToast();

   const estimateMutations = useTableMutations("estimates");
   const dealMutations = useTableMutations("deals");

   // Note:  useRecords Subscribe to estimate table changes so EstimateEditor re-renders
   //        when a record is updated. The estimate prop comes from SheetContext's
   //        stored data, which doesn't re-render when DealEstimatesContext updates
   //        (React skips children with unchanged element references).

   const estimateRecords = useRecords(config.tables.estimates);
   const liveEstimate = estimateRecords.find((r) => r.id === estimate.id) || estimate;

   const estimateInfo = useEstimateInfo(liveEstimate);
   const dealInfo = useDealInfo(deal);
   const studioInfo = useStudio(estimateInfo?.studioId);

   const organizationId = dealInfo?.getEstimateOrganizationId();
   const organizationInfo = useOrganizationInfo(organizationId);

   /** @type {EstimateEditorInfo} */
   const info = {
      studio: studioInfo,
      organization: organizationInfo,
      estimate: estimateInfo,
      deal: dealInfo,
   };

   /** @type {(updates: EstimateUpdateMap) => Promise<void>} */
   const updateEstimate = async (updates) => {
      let anyFailed = false;

      if (updates.estimate && estimateMutations) {
         const [success] = await estimateMutations.updateRecord(liveEstimate, updates.estimate);
         if (!success) { toastError("Não foi possível salvar o Orçamento."); anyFailed = true; }
      }

      if (updates.deal && dealMutations) {
         const [success] = await dealMutations.updateRecord(deal, updates.deal);
         if (!success) { toastError("Não foi possível salvar o Negócio."); anyFailed = true; }
      }

      if (!anyFailed && (updates.estimate || updates.deal)) {
         toast("Orçamento Salvo.", { duration: 2000, delay: 1000 });
      }
   };

   /** @type {{deal: (fieldKey: keyof DealFields) => import("../airtable/fields.js").FieldInspector, estimate: (fieldKey: keyof EstimateFields) => import("../airtable/fields.js").FieldInspector}} */
   const inspectors = {
      deal: (fieldKey) => dealMutations?.inspect(fieldKey),
      estimate: (fieldKey) => estimateMutations?.inspect(fieldKey),
   };

   return {
      updateEstimate,
      info,
      inspect: inspectors,
   };
}
