import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import { toLicenseTermInfo } from './useLicenseTerms.js'
import normalize from '../airtable/normalize.js'
import { FieldInspector } from '../airtable/fields.js'
import '../airtable/airtableTypes.js'

/** @typedef {import("@airtable/blocks/interface/models").Record} Record */
/** @typedef {import("../config/schemaRegistry.js").LicenseTermItemFields} LicenseTermItemFields */
/** @typedef {import("./useLicenseTerms.js").LicenseTermInfo} LicenseTermInfo */

/**
 * A license line item of a scenario — one row of the License Term Items table, the
 * license counterpart of a ServiceItem (see useServiceItems.js). It is
 * created *from* a License Term (see useLicenseTerms.js), which acts as its template.
 *
 * The item's own **override** values (`media`, `duration`, `exclusivity`, `scope`,
 * `territory`) are what the estimate renders and edits. The catalog's values — the
 * "reference" shown next to each override — come from `term`, the linked License Terms
 * record mapped through `toLicenseTermInfo`. No lookup fields are involved: a lookup of a
 * select can arrive as a plain string, losing the choice's id and color.
 *
 * `name` and `referenceValue` are flattened from `term` for convenience; `licenseTermId`
 * is empty until a term is linked to the line.
 *
 * @typedef {Object} LicenseTermItemInfo
 * @property {string} id
 * @property {string} name - the linked license term's name; "" when none is linked yet
 * @property {string} licenseTermId - the linked license term's record id; "" when none is linked
 * @property {LicenseTermInfo | null} term - the linked license term; null when none is linked (or not loaded)
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} discount - a whole percent (10 is 10%), whichever way the base stores it
 * @property {number} calculatedDiscount
 * @property {number} position - sort key within the scenario (see frontend/dnd/position.js)
 * @property {number | null} referenceValue - the linked term's reference value
 * @property {string} currencySymbol
 * @property {string} currency
 * @property {string} total
 * @property {string} media - override
 * @property {string} duration - override
 * @property {SingleSelectValue | null} exclusivity - override
 * @property {SingleSelectValue | null} scope - override
 * @property {SingleSelectValue[]} territory - override
 * @property {Record} record
 */

/**
 * Maps a License Term Items record to LicenseTermItemInfo. Pure, so it is unit-testable
 * with stub records; useLicenseTermItems is the hook around it.
 *
 * @param {Record} record
 * @param {LicenseTermItemFields} fields
 * @param {{ discountInspector: FieldInspector, termById: Map<string, LicenseTermInfo> }} deps
 *   - `discountInspector`: inspector for `fields.discount`, hoisted by the caller
 *   - `termById`: the License Terms catalog, keyed by record id
 * @returns {LicenseTermItemInfo}
 */
export function toLicenseTermItemInfo(record, fields, { discountInspector, termById }) {
   const linked = normalize.getLinkRecord(normalize.getCellValue(record, fields.licenseTermId))
   const term = (linked && termById.get(linked.id)) || null

   return {
      id: record.id,
      name: term?.name || linked?.name || '',
      licenseTermId: linked?.id || '',
      term,
      quantity: /** @type {number} */ (normalize.getCellValue(record, fields.quantity) || 0),
      unitPrice: /** @type {number} */ (normalize.getCellValue(record, fields.unitPrice) || 0),
      discount: /** @type {number} */ (
         discountInspector.convertFrom(normalize.getCellValue(record, fields.discount) || 0)
      ),
      calculatedDiscount: /** @type {number} */ (normalize.getCellValue(record, fields.calculatedDiscount) || 0),
      referenceValue: term?.referenceValue ?? null,
      currencySymbol: normalize.getCellValueAsString(record, fields.currencySymbol) || '',
      currency: normalize.getCellValueAsString(record, fields.currency) || '',
      total: normalize.getCellValueAsString(record, fields.total) || '',
      position: /** @type {number} */ (normalize.getCellValue(record, fields.position) || 0),

      media: normalize.getCellValueAsString(record, fields.mediaOverride) || '',
      duration: normalize.getCellValueAsString(record, fields.durationOverride) || '',
      exclusivity: normalize.getSingleSelectValue(normalize.getCellValue(record, fields.exclusivityOverride)),
      scope: normalize.getSingleSelectValue(normalize.getCellValue(record, fields.scopeOverride)),
      territory: normalize.listMultiSelectValues(normalize.getCellValue(record, fields.territoryOverride)),

      record,
   }
}

/**
 * The License Term Items of one scenario sorted by position (rows that tie keep the link
 * field's order), each with its linked license term resolved from the License Terms table.
 *
 * @param {string[]} itemIds
 * @returns {LicenseTermItemInfo[]}
 */
export function useLicenseTermItems(itemIds) {
   const { config } = useConfig()
   const { licenseTermItems, licenseTerms } = config.tables
   const fields = config.fields.licenseTermItem
   const termFields = config.fields.licenseTerm

   const records = useRecords(licenseTermItems)
   const termRecords = useRecords(licenseTerms)

   if (!itemIds || !Array.isArray(itemIds)) {
      console.warn(
         'You passed a null or undefined value to useLicenseTermItems. Please make sure to pass an array of item ids.',
      )
      return []
   }

   if (!records) return []

   // resolve the scenario's linked items; sorted by position below
   const recordById = new Map(records.map((r) => [r.id, r]))
   const itemRecords = /** @type {Record[]} */ (itemIds.map((id) => recordById.get(id)).filter(Boolean))

   // built once per render, shared by every row — the catalog is small
   const termById = new Map((termRecords ?? []).map((r) => [r.id, toLicenseTermInfo(r, termFields)]))

   // one inspector for every row — FieldInspector.for() rebuilds its maps on each call
   const discountInspector = FieldInspector.for(fields.discount)

   return itemRecords
      .map((r) => toLicenseTermItemInfo(r, fields, { discountInspector, termById }))
      .sort((a, b) => a.position - b.position)
}
