import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import normalize from '../airtable/normalize.js'
import '../airtable/airtableTypes.js'

/** @typedef {import("../config/schemaRegistry.js").LicenseTermFields} LicenseTermFields */
/** @typedef {import("@airtable/blocks/interface/models").Record} Record */

/**
 * A row of the License Terms table — the license catalog a License Term Item is created
 * from (see useLicenseTermItems.js), the way a Service is the template of a Scenario
 * Service Item.
 *
 * @typedef {Object} LicenseTermInfo
 * @property {string} id
 * @property {string} name
 * @property {SingleSelectValue | null} exclusivity
 * @property {SingleSelectValue | null} scope
 * @property {string} duration
 * @property {string} media
 * @property {SingleSelectValue[]} territory
 * @property {string} currency
 * @property {string} currencySymbol
 * @property {number | null} referenceValue
 * @property {string} formattedValue
 * @property {Record} record
 */

/**
 * Maps a License Terms record to LicenseTermInfo.
 *
 * @param {Record} record
 * @param {LicenseTermFields} licenseTermFields
 * @returns {LicenseTermInfo}
 */
export function toLicenseTermInfo(record, licenseTermFields) {
   return {
      id: record.id,
      name: record.name,
      exclusivity: normalize.getSingleSelectValue(normalize.getCellValue(record, licenseTermFields.exclusivity)),
      scope: normalize.getSingleSelectValue(normalize.getCellValue(record, licenseTermFields.scope)),
      duration: normalize.getCellValueAsString(record, licenseTermFields.duration) || '',
      media: normalize.getCellValueAsString(record, licenseTermFields.media) || '',
      territory: normalize.listMultiSelectValues(normalize.getCellValue(record, licenseTermFields.territory)),
      currency: normalize.getCellValueAsString(record, licenseTermFields.currency) || '',
      currencySymbol: normalize.getCellValueAsString(record, licenseTermFields.currencySymbol) || '',
      referenceValue: /** @type {number | null} */ (normalize.getCellValue(record, licenseTermFields.referenceValue)),
      formattedValue: normalize.getCellValueAsString(record, licenseTermFields.formattedValue) || '',
      record,
   }
}

/**
 * The terms of the catalog priced in a given currency — what a scenario's license
 * picker offers, so a term cannot be linked in a currency the scenario does not use.
 * Compared by name, case-insensitive and trimmed: the scenario's currency reaches an
 * item as a lookup string and the term's is a single-select name.
 *
 * `keepId` names a term to keep regardless (the item's currently linked one), so the
 * picker can still resolve its value if the scenario's currency changed since the link.
 * When `currency` is unknown ("") nothing is filtered.
 *
 * @param {LicenseTermInfo[]} terms
 * @param {string} currency - the scenario's currency, "" when unknown
 * @param {string} [keepId]
 * @returns {LicenseTermInfo[]}
 */
export function filterLicenseTermsByCurrency(terms, currency, keepId = '') {
   const wanted = currency.trim().toLowerCase()
   if (!wanted) return terms
   return terms.filter((t) => t.id === keepId || t.currency.trim().toLowerCase() === wanted)
}

/**
 * Looks up one license term in the License Terms table.
 *
 * @param {string | null | undefined} licenseTermId
 * @returns {LicenseTermInfo | null}
 */
export function useLicenseTerm(licenseTermId) {
   const { config, validation } = useConfig()
   const { licenseTerms } = config.tables
   const licenseTermFields = config.fields.licenseTerm

   const licenseTermRecords = useRecords(licenseTerms)

   if (!licenseTermId) return null

   if (!validation.valid()) {
      console.warn('useLicenseTerm: Invalid configuration.', validation.toJSON())
      return null
   }

   const licenseTermRecord = licenseTermRecords?.find((r) => r.id === licenseTermId)

   if (!licenseTermRecord) {
      console.warn(`useLicenseTerm: No license term found with id '${licenseTermId}'.`)
      return null
   }

   return toLicenseTermInfo(licenseTermRecord, licenseTermFields)
}

/**
 * Looks up all license terms in the License Terms table.
 * @returns {LicenseTermInfo[]}
 */
export function useLicenseTerms() {
   const { config, validation } = useConfig()
   const { licenseTerms } = config.tables
   const licenseTermFields = config.fields.licenseTerm

   // hooks first — the early returns below must not change the hook order between renders
   const licenseTermRecords = useRecords(licenseTerms)

   if (!validation.valid()) {
      console.warn('useLicenseTerms: Invalid configuration.', validation.toJSON())
      return []
   }

   if (!licenseTermRecords) {
      console.warn('useLicenseTerms: No license term records found.')
      return []
   }

   return licenseTermRecords.map((record) => toLicenseTermInfo(record, licenseTermFields)) || []
}
