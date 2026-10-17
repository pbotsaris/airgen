/**
 * Ambient JSDoc typedefs for the shapes Airtable cells read as.
 *
 * This file has no imports or exports on purpose: that keeps it a global script to
 * the TS language server, so every typedef here is visible codebase-wide. Files that
 * use them do `import "../airtable/airtableTypes.js"` for the side effect (and so the
 * dependency is visible to a reader), never a named import.
 */

/** A linked-record cell entry — one row of a Linked Record field.
 * @typedef {Object} LinkedRecordValue
 * @property {string} id
 * @property {string} name
 */

/** A collaborator cell (deal owner, assignee...).
 * @typedef {Object} OwnerValue
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} permissionLevel
 * @property {string} profilePicUrl
 */

/**
 * One choice of a Single Select / Multiple Selects field — the value such a cell reads
 * as, and the shape of each entry in `field.options.choices`.
 *
 * This is THE canonical {id, name, color} type: never re-declare it inline. `color` is an
 * Airtable color *name* (e.g. "blueBright"), not a hex — pass it through
 * `colorUtils.getHexForColor()` (or `FieldInspector.getColor()`) before styling with it.
 *
 * Data layer only. To feed a `<Select>` / `<PillOption>`, convert it to the UI-layer
 * {@link ComponentSelectOption} with `choiceToSelectOption(choice)` from
 * `frontend/components/recordOptions.js` — the one crossing between the two layers.
 * `<ChoiceBadge>` takes this type directly.
 *
 * @typedef {Object} SingleSelectValue
 * @property {string} id
 * @property {string} name
 * @property {string} color - Airtable color name, not a hex
 */
