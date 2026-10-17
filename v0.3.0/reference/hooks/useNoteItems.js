import { useRecords } from '@airtable/blocks/interface/ui'
import { useConfig } from './useConfig.js'
import { toNoteInfo } from './useNotes.js'
import normalize from '../airtable/normalize.js'
import '../airtable/airtableTypes.js'

/** @typedef {import("@airtable/blocks/interface/models").Record} Record */
/** @typedef {import("../config/schemaRegistry.js").NoteItemFields} NoteItemFields */
/** @typedef {import("./useNotes.js").NoteInfo} NoteInfo */

/**
 * A note of an estimate — one row of the Note Items table, the notes counterpart of a
 * LicenseTermItem (see useLicenseTermItems.js). It is created *from* a Note (see
 * useNotes.js), which acts as its template.
 *
 * The item's own **override** `description` is what the estimate renders and edits. The
 * catalog's text — the "reference" shown next to the override — comes from `note`, the
 * linked Notes record mapped through `toNoteInfo`, and is flattened as
 * `referenceDescription`. No lookup fields are involved, same as license term items.
 *
 * `name` and `category` are flattened from `note` for convenience; `noteId` is empty
 * until a note is linked to the item.
 *
 * @typedef {Object} NoteItemInfo
 * @property {string} id
 * @property {string} name - the linked note's name; the item's own name when none is linked
 * @property {string} noteId - the linked note's record id; "" when none is linked
 * @property {NoteInfo | null} note - the linked note; null when none is linked (or not loaded)
 * @property {string} estimateId - the linked estimate's record id; "" when none is linked
 * @property {SingleSelectValue | null} category - the linked note's category
 * @property {string} description - override, rich text as markdown
 * @property {string} referenceDescription - the linked note's description; "" when none is linked
 * @property {number} position - the item's position in the estimate, for sorting
 * @property {Record} record
 */

/**
 * Maps a Note Items record to NoteItemInfo. Pure, so it is unit-testable with stub
 * records; useNoteItems is the hook around it.
 *
 * @param {Record} record
 * @param {NoteItemFields} fields
 * @param {{ noteById: Map<string, NoteInfo> }} deps
 *   - `noteById`: the Notes catalog, keyed by record id
 * @returns {NoteItemInfo}
 */
export function toNoteItemInfo(record, fields, { noteById }) {
   const linked = normalize.getLinkRecord(normalize.getCellValue(record, fields.noteId))
   const note = (linked && noteById.get(linked.id)) || null

   const position = Number(normalize.getCellValue(record, fields.position)) || 0

   return {
      id: record.id,
      name: note?.name || linked?.name || record.name || '',
      noteId: linked?.id || '',
      note,
      estimateId: normalize.getLinkRecordId(normalize.getCellValue(record, fields.estimateId)) || '',
      category: note?.category ?? null,
      description: normalize.getCellValueAsString(record, fields.description) || '',
      referenceDescription: note?.description || '',
      position,
      record,
   }
}

/**
 * The Note Items with the given ids, sorted by `position` (stable, so rows that tie keep the
 * link field's order), each with its linked note resolved from the Notes table.
 *
 * @param {string[]} itemIds
 * @returns {NoteItemInfo[]}
 */
export function useNoteItems(itemIds) {
   const { config } = useConfig()
   const { noteItems, notes } = config.tables
   const fields = config.fields.noteItems
   const noteFields = config.fields.notes

   const records = useRecords(noteItems)
   const noteRecords = useRecords(notes)

   if (!itemIds || !Array.isArray(itemIds)) {
      console.warn(
         'You passed a null or undefined value to useNoteItems. Please make sure to pass an array of item ids.',
      )
      return []
   }

   if (!records) return []

   const recordById = new Map(records.map((r) => [r.id, r]))
   const itemRecords = /** @type {Record[]} */ (itemIds.map((id) => recordById.get(id)).filter(Boolean))

   // built once per render, shared by every row — the catalog is small
   const noteById = new Map((noteRecords ?? []).map((r) => [r.id, toNoteInfo(r, noteFields)]))

   return itemRecords.map((r) => toNoteItemInfo(r, fields, { noteById })).sort((a, b) => a.position - b.position)
}
