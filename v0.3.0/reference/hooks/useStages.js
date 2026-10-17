import * as React from 'react'
import { Record, Field, Table } from '@airtable/blocks/interface/models'
import { useRecords } from '@airtable/blocks/interface/ui'
import normalize from '../airtable/normalize.js'

export const UNASSIGNED_STAGE_ID = 'unassigned'
const NONE_STAGE = 'none'

/** @typedef {import('../config/schemaRegistry.js').StageFields} StageFields */

/**
 * @typedef {Record} StageRecord
 */

/**
 * @typedef {Object} StageGroup
 * @property {string} id - The name of the stage
 * @property {string} name - The name of the stage
 * @property {string} color - The color of the stage
 * @property {number} prob - The color of the stage
 * @property {number} order - The order of the stage
 * @property {boolean} canWin - Whether the stage can be marked as won
 * @property {boolean} secondary - Whether the stage belongs to the collapsible "recurring" group (Stages `secondary` checkbox)
 * @property {Record[]} records - Array of records in this stage
 */

/**
 * @typedef {Object} StageOptions
 * @property {StageFields|null} [stageFields] - resolved fields of the Stages table (`config.fields.stage`)
 * @property {string|null} [pipeline] - when set, only stages whose `pipeline` single select has this name are shown
 * @property {((record: Record) => number)|null} [rank] - optional primary sort key inside a column (lower first); ties fall back to the position field
 */

/** @typedef {Map<string, StageGroup>} StageMap */

/**
 * Hook to manage and group records by stage
 * @param {Table} stageTable - The table containing stage information
 * @param {Field} stageField - The field containing stage information
 * @param {Record[]|null} records - Array of records to group by stage
 * @param {Field|null} positionField - Optional field for sorting records within stages
 * @param {StageOptions} [options]
 * @returns {{stages: Array<[string, StageGroup]>, stagesMap: StageMap, noneStage: StageGroup}} Object containing stage entries iterator
 */
export function useStages(stageTable, stageField, records, positionField = null, options = {}) {
   const { stageFields = null, pipeline = null, rank = null } = options
   const allStageRecords = useRecords(stageTable)

   const stageRecords = React.useMemo(
      () =>
         sortStagesByOrder(
            filterStagesByPipeline(allStageRecords, stageFields?.pipeline ?? null, pipeline),
            stageFields?.order ?? null,
         ),
      [allStageRecords, stageFields?.pipeline, stageFields?.order, pipeline],
   )

   /** @type {[StageMap, StageGroup | null ]} */
   const [stages, noneStage] = React.useMemo(() => {
      const stageMap = newMap(stageRecords, stageFields)

      /** @type {StageGroup | null} */
      let noneStage = null

      if (!records || !stageField) return [stageMap, noneStage]

      for (const record of records) {
         const stageValue = /** @type {Object[]} */ (record.getCellValue(stageField))

         if (!stageValue) {
            console.warn(
               `Deal id ${record.id} and ${record.name} has no stage value for field ${stageField.name}: `,
               stageValue,
            )
            continue
         }

         if ('length' in stageValue) {
            const stageId = stageValue.length > 0 ? getId(stageValue) : null

            if (stageId && stageMap.has(stageId)) {
               stageMap.get(stageId).records.push(record)
            }
         }
      }

      // Sort records within each stage: by `rank` first (when given), then by position field
      for (const stageGroup of stageMap.values()) {
         if (stageGroup.name.toLowerCase() === NONE_STAGE.toLowerCase()) {
            noneStage = noneStage ?? stageGroup
            continue
         }

         if (!rank && !positionField) continue

         stageGroup.records.sort((a, b) => {
            if (rank) {
               const byRank = rank(a) - rank(b)
               if (byRank !== 0) return byRank
            }
            if (!positionField) return 0

            const posA = /** @type {number} */ (normalize.getCellValue(a, positionField) || 0)
            const posB = /** @type {number} */ (normalize.getCellValue(b, positionField) || 0)

            return posA - posB
         })
      }

      return [stageMap, noneStage]
   }, [stageRecords, stageFields, records, positionField, stageField, rank])

   return {
      stages: Array.from(stages.entries()),
      stagesMap: stages,
      noneStage: noneStage,
   }
}

/**
 * Keeps only the stages whose pipeline single select is named `pipeline` (case-insensitive, trimmed).
 * Returns the input untouched when no pipeline is requested or the field did not resolve,
 * so a base without the Pipeline field keeps showing every stage.
 * @param {StageRecord[]} stageRecords
 * @param {Field|null} pipelineField
 * @param {string|null|undefined} pipeline
 * @returns {StageRecord[]}
 */
export function filterStagesByPipeline(stageRecords, pipelineField, pipeline) {
   const wanted = (pipeline ?? '').trim().toLowerCase()
   if (!wanted || !pipelineField) return stageRecords

   return stageRecords.filter(
      (record) => normalize.getCellValueAsString(record, pipelineField).trim().toLowerCase() === wanted,
   )
}

/**
 * Sorts stages ascending by their `order` number. Stages without an order keep their
 * table order and go last; the input is returned untouched when the field did not resolve.
 * @param {StageRecord[]} stageRecords
 * @param {Field|null} orderField
 * @returns {StageRecord[]}
 */
export function sortStagesByOrder(stageRecords, orderField) {
   if (!orderField) return stageRecords

   /** @param {StageRecord} record @returns {number} */
   const orderOf = (record) => {
      const value = normalize.getCellValue(record, orderField)
      return typeof value === 'number' ? value : Number.POSITIVE_INFINITY
   }

   return [...stageRecords].sort((a, b) => orderOf(a) - orderOf(b))
}

/**
 * Creates a new Map of stages with empty record arrays
 * @param {StageRecord[]} stageRecords - Array of stage choices
 * @param {StageFields|null} stageFields - resolved Stages fields; `prob`/`order` fall back to defaults when null
 * @returns {Map<string, StageGroup>} Map of stage IDs to stage groups
 */
function newMap(stageRecords, stageFields) {
   /** @type {Map<string, StageGroup>} */

   const map = new Map()

   for (const record of stageRecords) {
      map.set(record.id, {
         id: record.id,
         name: record.name,
         prob: /** @type {number} */ (normalize.getCellValue(record, stageFields?.prob) || 1.0),
         order: /** @type {number} */ (normalize.getCellValue(record, stageFields?.order) || 0),
         color: 'gray', // TODO
         canWin: /** @type {boolean} */ (normalize.getCellValue(record, stageFields?.canWin) || false),
         secondary: normalize.getCellValue(record, stageFields?.secondary ?? null) === true,
         records: [],
      })
   }
   return map
}

/**
 * Extracts the ID from a stage value
 * @param {any} stageValue - The stage value from a record
 * @returns {string|null} The ID of the stage or null if not found
 */
function getId(stageValue) {
   if (stageValue && typeof stageValue === 'object' && 'id' in stageValue) {
      return stageValue.id
   }

   if (stageValue && Array.isArray(stageValue) && stageValue.length > 0) {
      return stageValue[0].id
   }

   return null
}
