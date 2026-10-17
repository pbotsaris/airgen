import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import normalize from '../airtable/normalize.js'
import '../airtable/airtableTypes.js'

/** @typedef {import("../config/schemaRegistry.js").NoteFields} NoteFields */
/** @typedef {import("@airtable/blocks/interface/models").Record} Record */

/**
 * A row of the Notes table — the notes catalog a Note Item is created from (see
 * useNoteItems.js), the way a License Term is the template of a License Term Item.
 *
 * @typedef {Object} NoteInfo
 * @property {string} id
 * @property {string} name
 * @property {SingleSelectValue | null} category
 * @property {string} description - rich text, as markdown
 * @property {OwnerValue | null} createdBy
 * @property {Record} record
 */

/**
 * Maps a Notes record to NoteInfo.
 *
 * @param {Record} record
 * @param {NoteFields} noteFields
 * @returns {NoteInfo}
 */
export function toNoteInfo(record, noteFields) {
   return {
      id: record.id,
      name: record.name,
      category: normalize.getSingleSelectValue(normalize.getCellValue(record, noteFields.category)),
      description: normalize.getCellValueAsString(record, noteFields.description) || '',
      createdBy: normalize.getUserRecord(normalize.getCellValue(record, noteFields.createdBy)),
      record,
   }
}

/**
 * Looks up one note in the Notes table.
 *
 * @param {string | null | undefined} noteId
 * @returns {NoteInfo | null}
 */
export function useNote(noteId) {
   const { config, validation } = useConfig()
   const { notes } = config.tables
   const noteFields = config.fields.notes

   const noteRecords = useRecords(notes)

   if (!noteId) return null

   if (!validation.valid()) {
      console.warn('useNote: Invalid configuration.', validation.toJSON())
      return null
   }

   const noteRecord = noteRecords?.find((r) => r.id === noteId)

   if (!noteRecord) {
      console.warn(`useNote: No note found with id '${noteId}'.`)
      return null
   }

   return toNoteInfo(noteRecord, noteFields)
}

/**
 * Looks up all notes in the Notes table.
 * @returns {NoteInfo[]}
 */
export function useNotes() {
   const { config, validation } = useConfig()
   const { notes } = config.tables
   const noteFields = config.fields.notes

   // hooks first — the early returns below must not change the hook order between renders
   const noteRecords = useRecords(notes)

   if (!validation.valid()) {
      console.warn('useNotes: Invalid configuration.', validation.toJSON())
      return []
   }

   if (!noteRecords) {
      console.warn('useNotes: No note records found.')
      return []
   }

   return noteRecords.map((record) => toNoteInfo(record, noteFields))
}
