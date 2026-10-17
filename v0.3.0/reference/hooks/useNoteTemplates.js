import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import { toNoteInfo } from './useNotes.js'
import normalize from '../airtable/normalize.js'
import '../airtable/airtableTypes.js'

/** @typedef {import("@airtable/blocks/interface/models").Record} Record */
/** @typedef {import("../config/schemaRegistry.js").NoteTemplateFields} NoteTemplateFields */
/** @typedef {import("./useNotes.js").NoteInfo} NoteInfo */

/**
 * A row of the Note Templates table — a named set of Notes (see useNotes.js) that can be
 * applied to an estimate at once, creating one Note Item per note (see useNoteItems.js).
 *
 * `notes` holds the linked notes resolved from the Notes table, in the link field's order;
 * a linked note that is not loaded is skipped there but still counted in `noteIds`.
 *
 * @typedef {Object} NoteTemplateInfo
 * @property {string} id
 * @property {string} name
 * @property {string[]} noteIds - the linked notes' record ids, in link order
 * @property {NoteInfo[]} notes - the linked notes, in link order
 * @property {Record} record
 */

/**
 * Maps a Note Templates record to NoteTemplateInfo. Pure, so it is unit-testable with
 * stub records; useNoteTemplate(s) are the hooks around it.
 *
 * @param {Record} record
 * @param {NoteTemplateFields} fields
 * @param {{ noteById: Map<string, NoteInfo> }} deps
 *   - `noteById`: the Notes catalog, keyed by record id
 * @returns {NoteTemplateInfo}
 */
export function toNoteTemplateInfo(record, fields, { noteById }) {
   const noteIds = normalize.listLinkRecordIds(normalize.getCellValue(record, fields.noteIds))

   return {
      id: record.id,
      name: record.name,
      noteIds,
      notes: /** @type {NoteInfo[]} */ (noteIds.map((id) => noteById.get(id)).filter(Boolean)),
      record,
   }
}

/**
 * Builds the Notes catalog keyed by record id — shared by both hooks below.
 *
 * @param {Record[] | null} noteRecords
 * @param {import("../config/schemaRegistry.js").NoteFields} noteFields
 * @returns {Map<string, NoteInfo>}
 */
function buildNoteById(noteRecords, noteFields) {
   return new Map((noteRecords ?? []).map((r) => [r.id, toNoteInfo(r, noteFields)]))
}

/**
 * Looks up one template in the Note Templates table, with its notes resolved.
 *
 * @param {string | null | undefined} templateId
 * @returns {NoteTemplateInfo | null}
 */
export function useNoteTemplate(templateId) {
   const { config, validation } = useConfig()
   const { noteTemplates, notes } = config.tables
   const fields = config.fields.noteTemplates
   const noteFields = config.fields.notes

   const templateRecords = useRecords(noteTemplates)
   const noteRecords = useRecords(notes)

   if (!templateId) return null

   if (!validation.valid()) {
      console.warn('useNoteTemplate: Invalid configuration.', validation.toJSON())
      return null
   }

   const templateRecord = templateRecords?.find((r) => r.id === templateId)

   if (!templateRecord) {
      console.warn(`useNoteTemplate: No note template found with id '${templateId}'.`)
      return null
   }

   return toNoteTemplateInfo(templateRecord, fields, { noteById: buildNoteById(noteRecords, noteFields) })
}

/**
 * Looks up all templates in the Note Templates table, each with its notes resolved.
 * @returns {NoteTemplateInfo[]}
 */
export function useNoteTemplates() {
   const { config, validation } = useConfig()
   const { noteTemplates, notes } = config.tables
   const fields = config.fields.noteTemplates
   const noteFields = config.fields.notes

   // hooks first — the early returns below must not change the hook order between renders
   const templateRecords = useRecords(noteTemplates)
   const noteRecords = useRecords(notes)

   if (!validation.valid()) {
      console.warn('useNoteTemplates: Invalid configuration.', validation.toJSON())
      return []
   }

   if (!templateRecords) {
      console.warn('useNoteTemplates: No note template records found.')
      return []
   }

   // built once per render, shared by every template — the catalog is small
   const noteById = buildNoteById(noteRecords, noteFields)

   return templateRecords.map((record) => toNoteTemplateInfo(record, fields, { noteById }))
}
