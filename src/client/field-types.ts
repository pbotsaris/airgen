/**
 * Per-type write facts, shared by the generator (which emits `<Table>Write`
 * from them) and the runtime (which converts values into those shapes). One
 * table, so the emitted write type and the value the runtime hands the SDK
 * can't disagree about a field type.
 *
 * Kinds follow the **Cell write format** docs in the SDK's `field_core.d.ts`.
 */

/** The cell write format a field type accepts, grouped by shape. */
export type WriteKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'singleChoice'
  | 'multiChoice'
  | 'collaborator'
  | 'collaborators'
  | 'links'
  | 'attachments';

const WRITE_KINDS = new Map<string, WriteKind | null>([
  ['singleLineText', 'text'],
  ['multilineText', 'text'],
  ['richText', 'text'],
  ['email', 'text'],
  ['url', 'text'],
  ['phoneNumber', 'text'],

  ['number', 'number'],
  ['percent', 'number'],
  ['currency', 'number'],
  ['rating', 'number'],
  ['duration', 'number'],

  ['checkbox', 'boolean'],

  ['date', 'date'],
  ['dateTime', 'date'],

  ['singleSelect', 'singleChoice'],
  ['multipleSelects', 'multiChoice'],
  ['singleCollaborator', 'collaborator'],
  ['multipleCollaborators', 'collaborators'],
  ['multipleRecordLinks', 'links'],
  ['multipleAttachments', 'attachments'],

  // Computed: the SDK documents no write format and reports `isComputed`.
  ['formula', null],
  ['rollup', null],
  ['count', null],
  ['multipleLookupValues', null],
  ['autoNumber', null],
  ['createdTime', null],
  ['lastModifiedTime', null],
  ['createdBy', null],
  ['lastModifiedBy', null],
  ['button', null],
  ['externalSyncSource', null],
  ['aiText', null],

  // "Cell write format: n/a" in both SDK builds even though `isComputed` is
  // false — the one type where the docs and the flag disagree.
  ['barcode', null],
]);

/**
 * The write kind for a field type: a `WriteKind`, `null` when the type has no
 * cell write format, or `undefined` for a type airgen doesn't know (a field
 * type newer than this release).
 */
export function writeKind(type: string): WriteKind | null | undefined {
  return WRITE_KINDS.get(type);
}
