import { useConfig } from './useConfig'
import normalize from '../airtable/normalize.js'
import { Record } from '@airtable/blocks/interface/models'
import '../airtable/airtableTypes.js'

/** @typedef {'simple' | 'scenario' | 'multi-delivery' | 'none'} TemplateType */

// NOTE: Keep this constant. If mapping is incorrect, better to change the airtable formula to avoid changing the code.
/** @param {number} id
 * @return {TemplateType}
 */
const TEMPLATE_ID_MAPPING = (id) => {
   switch (id) {
      case 0:
         return 'simple'
      case 1:
         return 'scenario'
      case 2:
         return 'multi-delivery'
      default:
         return 'none'
   }
}

/** @typedef {Object} EstimateInfo
 * @property {string} id
 * @property {string} name
 * @property {string | null} studioId
 * @property {string | null} dealId
 * @property {string[]} scenarioIds
 * @property {string} templateURL
 * @property {string} projectName
 * @property {string} currencySymbol
 * @property {string} total
 * @property {string} date
 * @property {SingleSelectValue | null} template
 * @property {TemplateType} templateType
 * @property {SingleSelectValue | null} status
 * @property {string[]} noteItemIds
 */

/** @exports EstimateInfo */

/** @param {Record} record
 *  @returns {EstimateInfo}
 */
export function useEstimateInfo(record) {
   const { config, validation } = useConfig()

   if (!validation.valid()) {
      console.warn('Invalid configuration:', validation)
      return null
   }

   const { estimate: fields } = config.fields

   const invoiceBy = normalize.getLinkRecordId(normalize.getCellValue(record, fields.invoiceBy))
   const dealId = normalize.getLinkRecordId(normalize.getCellValue(record, fields.deal))
   const scenarioIds = normalize.listLinkRecordIds(normalize.getCellValue(record, fields.scenarios))
   const template = normalize.getSingleSelectValue(normalize.getCellValue(record, fields.template))
   const templateId = /** @type {number} */ (normalize.getCellValue(record, fields.templateId))
   const templateURL = normalize.getCellValueAsString(record, fields.templateUrl)
   const projectName = normalize.getCellValueAsString(record, fields.projectName)
   const status = normalize.getSingleSelectValue(normalize.getCellValue(record, fields.status))
   const currencySymbol = normalize.getCellValueAsString(record, fields.currencySymbol)
   const total = normalize.getCellValueAsString(record, fields.total)
   const date = /** @type {string} */ (normalize.getCellValue(record, fields.date))

   const noteItemIds = normalize.listLinkRecordIds(normalize.getCellValue(record, fields.noteItems))

   return {
      id: record.id,
      name: record.name,
      studioId: invoiceBy,
      dealId: dealId,
      status: status,
      scenarioIds: scenarioIds,
      template: template,
      templateType: TEMPLATE_ID_MAPPING(templateId),
      templateURL: templateURL,
      projectName: projectName,
      currencySymbol: currencySymbol,
      total: total,
      date: date,
      noteItemIds: noteItemIds,
   }
}
