/**
 * Consumer-style type assertions for the generated write types (stable/base
 * SDK flavor). generator.test.js copies this next to a freshly generated
 * `airtable-schema.ts` and compiles both under `tsc --strict`: the positive
 * cases must typecheck and every `@ts-expect-error` must be a real error.
 */
import {airgenMeta} from './airtable-schema';
import type {ProjectsWrite, TableWriteMap, TableRecordMap} from './airtable-schema';

export const create: ProjectsWrite = {
  name: 'Site redesign',
  budget: 1200.5,
  done: true,
  startDate: new Date(),
  kickoff: '2026-10-17T09:00:00.000Z',
  status: {id: 'selTodo000000001'},
  tags: [{name: 'Dev'}, {id: 'selDesign0000001'}],
  tasks: [{id: 'recTask000000001'}, {id: 'recTask000000002', name: 'Optimistic label'}],
  files: [{url: 'https://example.com/a.pdf', filename: 'a.pdf'}],
  owner: {id: 'usrOwner000000001'},
  team: [{id: 'usrOwner000000001'}],
};

/** Lookups read as {linkedRecordId, value} entries, typed by the looked-up field. */
export function lookupNames(record: TableRecordMap['Projects']): string[] {
  return (record.taskNames ?? []).map(entry => entry.value);
}

// @ts-expect-error a lookup cell is entries, not bare values
export const bareLookup: TableRecordMap['Projects']['taskNames'] = ['Kickoff'];

/** null clears a cell for every writable type. */
export const clear: ProjectsWrite = {name: null, budget: null, done: null, status: null, tags: null, tasks: null};

/** Every property is optional, so a partial update needs no wrapper type. */
export const partial: ProjectsWrite = {};

// @ts-expect-error a number field rejects strings
export const wrongScalar: ProjectsWrite = {budget: 'twelve'};

// @ts-expect-error formula fields are computed and not writable
export const computed: ProjectsWrite = {daysLeft: 1};

// @ts-expect-error button fields are computed and not writable
export const button: ProjectsWrite = {open: {label: 'x', url: null}};

// @ts-expect-error aiText fields are computed and not writable
export const aiText: ProjectsWrite = {summary: {state: 'generated', value: '', isStale: false}};

// @ts-expect-error unknown choice id
export const unknownChoiceId: ProjectsWrite = {status: {id: 'selNope000000001'}};

// @ts-expect-error unknown choice name
export const unknownChoiceName: ProjectsWrite = {tags: [{name: 'Marketing'}]};

// @ts-expect-error links need an id on the stable/base SDK; only the interface SDK creates by name
export const linkByName: ProjectsWrite = {tasks: [{name: 'New task'}]};

// @ts-expect-error the SDK documents no cell write format for barcode
export const barcode: ProjectsWrite = {barcode: {text: '123'}};

// @ts-expect-error collaborators are written by id only
export const collaboratorByEmail: ProjectsWrite = {owner: {email: 'a@b.c'}};

/** Read and write maps share the same table keys. */
export const sameKeys: keyof TableWriteMap extends keyof TableRecordMap ? true : never = true;

/** Meta v2 is `as const`, so writability and the primary field are literal types. */
export const version: 3 = airgenMeta.version;
export const primaryFieldId: 'fldName0000000001' = airgenMeta.tables.Projects.primaryFieldId;
export const formulaIsComputed: true = airgenMeta.tables.Projects.fields.daysLeft.isComputed;
export const textIsWritable: false = airgenMeta.tables.Projects.fields.name.isComputed;
