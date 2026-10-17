import * as React from "react";
import { useRecords } from "@airtable/blocks/interface/ui";
import { useConfig } from "./useConfig.js";
import { useTableMutations } from "./useTableMutations.js";
import { useMutationRunner } from "./useMutationRunner.js";
import { useOpenEstimateWhenLoaded, DRAFT_STATUS_NAME } from "./useCreateEstimate.js";
import { duplicateEstimate } from "../estimates/duplicateEstimate.js";

/** @typedef {import('@airtable/blocks/interface/models').Record} AirtableRecord */
/** @typedef {import('../context/SheetContext.jsx').SheetRequest} SheetRequest */

/**
 * Deep-copies an estimate as a new draft (see `duplicateEstimate`) and opens the copy in
 * the editor sheet. The "Revisar" action on a rejected estimate.
 *
 * Subscribes to the four child tables, so mount it where the list of estimates renders
 * (inside the popover), not on every card.
 *
 * @param {AirtableRecord} deal
 * @param {{ content: SheetRequest['content'], title?: string, onOpen?: () => void }} sheet
 * @returns {{ duplicate: (estimate: AirtableRecord) => Promise<void> | undefined, pending: boolean }} `pending` holds until the sheet has opened
 */
export function useDuplicateEstimate(deal, { content, title = "Revisar Orçamento", onOpen }) {
   const { config } = useConfig();
   const { pending: writing, attempt } = useMutationRunner();
   const { requestOpen, opening } = useOpenEstimateWhenLoaded(deal, { title, content, onOpen });

   const estimates = useTableMutations("estimates");
   const scenarios = useTableMutations("scenarios");
   const serviceItems = useTableMutations("serviceItems");
   const licenseTermItems = useTableMutations("licenseTermItems");
   const noteItems = useTableMutations("noteItems");

   const scenarioRecords = useRecords(config.tables.scenarios);
   const serviceItemRecords = useRecords(config.tables.serviceItems);
   const licenseTermItemRecords = useRecords(config.tables.licenseTermItems);
   const noteItemRecords = useRecords(config.tables.noteItems);

   const recordsById = React.useMemo(
      () => ({
         scenarios: byId(scenarioRecords),
         serviceItems: byId(serviceItemRecords),
         licenseTermItems: byId(licenseTermItemRecords),
         noteItems: byId(noteItemRecords),
      }),
      [scenarioRecords, serviceItemRecords, licenseTermItemRecords, noteItemRecords],
   );

   const duplicate = React.useCallback(
      /** @param {AirtableRecord} source */
      (source) => {
         if (!estimates || !scenarios || !serviceItems || !licenseTermItems || !noteItems) return;

         const draftChoice = estimates.inspect("status").getChoiceByName(DRAFT_STATUS_NAME);
         const { estimate, scenario, serviceItem, licenseTermItem, noteItems: noteItemFields } = config.fields;

         return attempt(
            () =>
               duplicateEstimate({
                  source,
                  fields: { estimate, scenario, serviceItem, licenseTermItem, noteItems: noteItemFields },
                  mutations: { estimates, scenarios, serviceItems, licenseTermItems, noteItems },
                  recordsById,
                  draftChoice,
               }),
            {
               ok: "Orçamento duplicado como rascunho.",
               fail: String,
               onOk: (id) => requestOpen(/** @type {string} */ (id)),
            },
         );
      },
      [estimates, scenarios, serviceItems, licenseTermItems, noteItems, config.fields, recordsById, attempt, requestOpen],
   );

   return { duplicate, pending: writing || opening };
}

/**
 * @param {AirtableRecord[] | null | undefined} records
 * @returns {Map<string, AirtableRecord>}
 */
function byId(records) {
   return new Map((records ?? []).map((r) => [r.id, r]));
}
