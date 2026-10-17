import * as React from 'react'
import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import { useSheet } from '../context/SheetContext.jsx'
import { useTableMutations } from './useTableMutations.js'
import { useMutationRunner } from './useMutationRunner.js'

import '../airtable/airtableTypes.js'

/** @typedef {import('@airtable/blocks/interface/models').Record} AirtableRecord */
/** @typedef {import('../context/SheetContext.jsx').SheetRequest} SheetRequest */
/** @typedef {import('../config/schemaRegistry.js').ScenarioFields} ScenarioFields */
/** @typedef {import('../airtable/mutations.js').MutableTable<ScenarioFields>} ScenarioMutations */

/** The estimate status a new estimate starts in (matched case-insensitively by name). */
export const DRAFT_STATUS_NAME = 'rascunho'

/**
 * Opens an estimate in the editor sheet once its record has loaded.
 *
 * A create only hands back the new id, while the sheet needs the `Record`; so the id is
 * parked in state and the sheet opens from an effect once `useRecords` has the row.
 *
 * Mount it in a component that outlives the action: if the caller unmounts while the id is
 * parked (say, because the card re-renders into a different button), the sheet never opens.
 *
 * @param {AirtableRecord} deal
 * @param {{ title: string, content: SheetRequest['content'], onOpen?: () => void }} sheet - `onOpen` runs right after the sheet opens (e.g. to close the popover the action started from)
 * @returns {{ requestOpen: (estimateId: string) => void, opening: boolean }} `opening` is true from the request until the sheet opens
 */
export function useOpenEstimateWhenLoaded(deal, { title, content, onOpen }) {
   const { config } = useConfig()
   const { openSheet } = useSheet()
   const estimateRecords = useRecords(config.tables.estimates)

   const [openId, setOpenId] = React.useState(/** @type {string | null} */ (null))

   React.useEffect(() => {
      if (!openId) return
      const estimate = estimateRecords?.find((r) => r.id === openId)
      if (!estimate) return

      setOpenId(null)
      openSheet({ data: { estimate, deal }, title, content })
      onOpen?.()
   }, [openId, estimateRecords, openSheet, deal, title, content, onOpen])

   return { requestOpen: setOpenId, opening: openId !== null }
}

/**
 * Creates a draft estimate linked to `deal`, with one scenario to start from, and opens it
 * in the editor sheet.
 *
 * The scenario is created first, since the estimate owns the list (see AddScenario). If the
 * estimate then fails to create, the scenario is deleted again so nothing is left orphaned.
 * A scenario that fails to create is not fatal: the estimate is still created, just empty.
 *
 * @param {AirtableRecord} deal
 * @param {{ content: SheetRequest['content'], title?: string, onOpen?: () => void }} sheet
 * @returns {{ createEstimate: () => Promise<void> | undefined, pending: boolean }} `pending` holds until the sheet has opened
 */
export function useCreateEstimate(deal, { content, title = 'Novo Orçamento', onOpen }) {
   const estimateMutations = useTableMutations('estimates')
   const scenarioMutations = useTableMutations('scenarios')

   const { pending: writing, attempt } = useMutationRunner()

   const { requestOpen, opening } = useOpenEstimateWhenLoaded(deal, { title, content, onOpen })

   const createEstimate = React.useCallback(() => {
      if (!estimateMutations) return
      const draft = estimateMutations.inspect('status').getChoiceByName(DRAFT_STATUS_NAME)

      const create = async () => {
         const scenarioId = await createScenario(scenarioMutations)

         const result = await estimateMutations.create(buildDraftEstimateValues(deal.id, scenarioId, draft))

         const [created] = result
         if (!created && scenarioId && scenarioMutations) await scenarioMutations.delete(scenarioId)

         return result
      }

      return attempt(create, {
         ok: 'Orçamento criado.',
         fail: (err) => `Falha ao criar o orçamento: ${err}`,
         onOk: (id) => requestOpen(/** @type {string} */ (id)),
      })
   }, [estimateMutations, scenarioMutations, attempt, deal.id, requestOpen])

   return { createEstimate, pending: writing || opening }
}

/** @typedef EstimateDraftValues
 * @property {{id: string}[]} deal - The deal the estimate is linked to.
 * @property {{id: string}} [status] - The status the estimate starts in, if any.
 * @property {{id: string}[]} [scenarios] - The scenarios the estimate is linked to.
 */

/**
 * The values a new draft estimate is created with: linked to its deal from the start (never
 * left for later), in the draft status when the status field has one, and owning its first
 * scenario when one was created.
 *
 * @param {string} dealId
 * @param {string | null} scenarioId
 * @param {SingleSelectValue | null | undefined} draftChoice
 * @returns {EstimateDraftValues}
 */
function buildDraftEstimateValues(dealId, scenarioId, draftChoice) {
   /** @type {EstimateDraftValues} */
   const values = { deal: [{ id: dealId }] }

   if (draftChoice) values.status = { id: draftChoice.id }
   if (scenarioId) values.scenarios = [{ id: scenarioId }]

   return values
}

/**
 * The first scenario of a new estimate, or `null` when it could not be created — logged,
 * not raised, since an estimate without a scenario is still usable.
 *
 * @param {ScenarioMutations | null} mutations
 * @returns {Promise<string | null>}
 */
async function createScenario(mutations) {
   if (!mutations) {
      console.error('Scenario mutations not available when creating a new draft estimate.')
      return null
   }

   const [created, idOrError] = await mutations.create({ order: 1 })

   if (!created) {
      console.error('Failed to create a scenario for the new draft estimate:', idOrError)
      return null
   }

   return /** @type {string} */ (idOrError)
}
