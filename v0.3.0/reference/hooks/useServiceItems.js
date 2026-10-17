import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import normalize from '../airtable/normalize.js'
import { FieldInspector } from '../airtable/fields.js'
import { Record } from '@airtable/blocks/interface/models'

/**
 * A line item of a scenario — one row of the ScenarioItems table. It is
 * created *from* a Service (see useService.js), which acts as its template: the
 * linked service supplies the display name and the category color, while quantity,
 * unit price and discount are the line's own.
 *
 * The linked service is flattened into the item rather than nested: `name` is the
 * service's name, and `serviceId` is empty until a service is linked to the line.
 *
 * @typedef {Object} ServiceItemInfo
 * @property {string} id
 * @property {string} name - the linked service's name; "" when no service is linked yet
 * @property {string} description
 * @property {number} quantity
 * @property {number} position - sort key within the scenario (see frontend/dnd/position.js)
 * @property {number} unitPrice
 * @property {number} discount - a whole percent (10 is 10%), whichever way the base stores it
 * @property {string} referenceValue
 * @property {string} referenceDescription
 * @property {string} currencySymbol
 * @property {string} currency
 * @property {string} serviceId - the linked service's record id; "" when none is linked
 * @property {string | null} serviceColor - hex for the linked service's `type`, for the category dot
 * @property {string} total
 * @property {Record} record
 * @property {number} calculatedDiscount
 */

/** @param {string[]} itemIds
 * @returns {ServiceItemInfo[]}
 */
export function useServiceItems(itemIds) {
   const { config } = useConfig()
   const { serviceItems } = config.tables

   const scenarioItemFields = config.fields.serviceItem

   const records = useRecords(serviceItems)

   if (!itemIds || !Array.isArray(itemIds)) {
      console.warn(
         'You passed a null or undefined value to useServiceItems. Please make sure to pass an array of item ids.',
      )
      return []
   }

   if (!records) return []

   // resolve the scenario's linked items, then sort by position (stable, so rows that tie —
   // legacy rows all reading 0 — keep the link field's order)
   const recordById = new Map(records.map((r) => [r.id, r]))
   const itemRecords = itemIds.map((id) => recordById.get(id)).filter(Boolean)

   // one inspector for every row — the choice → color map is rebuilt on each FieldInspector.for()
   const servInpect = FieldInspector.for(scenarioItemFields.serviceType)
   const discInspect = FieldInspector.for(scenarioItemFields.discount)

   return /** @type {ServiceItemInfo[]} */ (
      itemRecords.map((r) => {
         const typeValue = normalize.getLookupValue(normalize.getCellValue(r, scenarioItemFields.serviceType))
         const linked = normalize.getLinkRecord(normalize.getCellValue(r, scenarioItemFields.serviceId))

         return {
            id: r.id,
            name: linked?.name || '',
            description: normalize.getCellValueAsString(r, scenarioItemFields.description) || '',
            quantity: /** @type {number} */ (normalize.getCellValue(r, scenarioItemFields.quantity) || 0),
            unitPrice: /** @type {number} */ (normalize.getCellValue(r, scenarioItemFields.unitPrice) || 0),
            discount: /** @type {number} */ (
               discInspect.convertFrom(normalize.getCellValue(r, scenarioItemFields.discount) || 0)
            ),
            referenceValue: normalize.getCellValueAsString(r, scenarioItemFields.referenceValue) || '',
            referenceDescription: normalize.getCellValueAsString(r, scenarioItemFields.referenceDescription) || '',
            currencySymbol: normalize.getCellValueAsString(r, scenarioItemFields.currencySymbol) || '',
            currency: normalize.getCellValueAsString(r, scenarioItemFields.currency) || '',
            serviceId: linked?.id || '',
            serviceColor: servInpect.getColor(typeValue),
            total: normalize.getCellValueAsString(r, scenarioItemFields.total) || '',
            calculatedDiscount: normalize.getCellValue(r, scenarioItemFields.calculatedDiscount) || 0,
            position: /** @type {number} */ (normalize.getCellValue(r, scenarioItemFields.position) || 0),
            record: r,
         }
      })
   ).sort((a, b) => a.position - b.position)
}
