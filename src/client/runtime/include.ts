/**
 * Relational `include`: the join behind `useRecords(key, {include})`.
 *
 * The schema already says which table every `multipleRecordLinks` field points
 * at, so a consumer never declares a relationship — it names the links to
 * follow and gets rows whose link cells hold the linked table's typed rows
 * instead of `{id, name}` stubs. Two pure steps:
 *
 * 1. `planInclude` turns the spec into a tree of steps, one per spec key at
 *    every depth, each resolving its target table (live `linkedTableId`) and
 *    the meta to read it with. A key that can't be followed is still a step,
 *    marked `skipped`, so the number of steps is a pure function of the spec
 *    literal — the hook calls `useRecords` once per step and React needs that
 *    count stable across renders.
 * 2. `hydrate` joins by id: each link entry becomes the loaded record's row, a
 *    link whose record isn't loaded (deleted, hidden) is dropped, and anything
 *    that isn't a link cell is left untouched.
 *
 * Nothing here throws. Depth is capped and cycles (a target already on the
 * path) are refused at runtime too, mirroring the type-level rules.
 */

import type {SdkBase, SdkRecord, SdkTable} from '../sdk.js';
import type {AirgenTableMeta} from '../useTypedRecords.js';
import {resolveTableOverride} from './resolver.js';

/** How many links deep an include may go: `{tasks: {assignee: true}}` is 2. */
export const MAX_INCLUDE_DEPTH = 2;

export type IncludeSkipReason =
  /** The key isn't a link field of the table (or the live field isn't one anymore). */
  | 'not-a-link'
  /** Nested deeper than `MAX_INCLUDE_DEPTH`. */
  | 'depth-exceeded'
  /** The target table is already on the include path. */
  | 'cycle'
  /** The meta knows no table for the target: a pre-0.4.0 file, or a table outside the base. */
  | 'no-target-meta'
  /** The live target table is deleted or hidden from this extension. */
  | 'target-unavailable'
  /** A parent step was skipped, so there is nothing to follow from. */
  | 'unreachable';

export interface IncludeStep {
  /** Field keys from the root row down to this link. */
  readonly path: ReadonlyArray<string>;
  readonly fieldKey: string;
  /** The live target table; null when skipped. */
  readonly table: SdkTable | null;
  /** The target's meta, rebased onto `table` when the live link points at a look-alike. */
  readonly tableMeta: AirgenTableMeta | null;
  readonly skipped: IncludeSkipReason | null;
  readonly children: ReadonlyArray<IncludeStep>;
}

export interface IncludeContext {
  readonly base: SdkBase;
  /** Every generated table meta by its generated table id. */
  readonly metaTablesById: ReadonlyMap<string, AirgenTableMeta>;
  readonly maxDepth?: number;
}

/** The row shape `useRecords` returns, before the generics narrow it. */
export interface Row {
  id: string;
  name: string;
  fields: {[fieldKey: string]: unknown};
  raw: SdkRecord;
}

/** One typed row: the meta's field keys, read by id, absent when null or missing. */
export function buildRow(record: SdkRecord, table: SdkTable, tableMeta: AirgenTableMeta): Row {
  const fields: {[fieldKey: string]: unknown} = {};

  for (const [fieldKey, fieldMeta] of Object.entries(tableMeta.fields)) {
    const field = table.getFieldByIdIfExists(fieldMeta.id);
    if (!field) continue; // deleted (or hidden from this extension) since generation

    const value = record.getCellValue(field);
    if (value !== null && value !== undefined) fields[fieldKey] = value;
  }

  return {id: record.id, name: record.name, fields, raw: record};
}

function isSpecObject(spec: unknown): spec is {readonly [key: string]: unknown} {
  return typeof spec === 'object' && spec !== null && !Array.isArray(spec);
}

/** The spec's keys in a fixed order, falsy values dropped (plain-JS callers). */
function specEntries(spec: unknown): Array<[string, unknown]> {
  if (!isSpecObject(spec)) return [];
  return Object.keys(spec)
    .filter(key => Boolean(spec[key]))
    .sort()
    .map(key => [key, spec[key]]);
}

/**
 * The include tree for `spec` rooted at `table`. Deterministic: keys are
 * sorted, and every key yields exactly one step whether or not it resolves.
 */
export function planInclude(
  spec: unknown,
  table: SdkTable | null,
  tableMeta: AirgenTableMeta,
  context: IncludeContext,
): IncludeStep[] {
  return plan(spec, table, tableMeta, context, [], table ? [table.id] : []);
}

function plan(
  spec: unknown,
  table: SdkTable | null,
  tableMeta: AirgenTableMeta | null,
  context: IncludeContext,
  path: ReadonlyArray<string>,
  visitedTableIds: ReadonlyArray<string>,
): IncludeStep[] {
  const maxDepth = context.maxDepth ?? MAX_INCLUDE_DEPTH;

  return specEntries(spec).map(([fieldKey, child]) => {
    const stepPath = [...path, fieldKey];
    const skipped = (reason: IncludeSkipReason): IncludeStep => ({
      path: stepPath,
      fieldKey,
      table: null,
      tableMeta: null,
      skipped: reason,
      children: plan(child, null, null, context, stepPath, visitedTableIds),
    });

    if (!table || !tableMeta) return skipped('unreachable');
    if (stepPath.length > maxDepth) return skipped('depth-exceeded');

    const fieldMeta = tableMeta.fields[fieldKey];
    if (!fieldMeta || fieldMeta.type !== 'multipleRecordLinks') return skipped('not-a-link');

    // The live field decides where the link points: on a look-alike table
    // (custom property pick) the generated `linkedTableId` may be another base's.
    const liveField = table.getFieldByIdIfExists(fieldMeta.id);
    if (!liveField || liveField.type !== 'multipleRecordLinks') return skipped('not-a-link');
    const liveTargetId = liveField.options?.linkedTableId;

    const generatedMeta =
      (fieldMeta.linkedTableId !== undefined ? context.metaTablesById.get(fieldMeta.linkedTableId) : undefined) ??
      (typeof liveTargetId === 'string' ? context.metaTablesById.get(liveTargetId) : undefined);
    if (!generatedMeta) return skipped('no-target-meta');

    const liveTarget = typeof liveTargetId === 'string' ? context.base.getTableByIdIfExists(liveTargetId) : null;
    if (!liveTarget) return skipped('target-unavailable');
    if (visitedTableIds.includes(liveTarget.id)) return skipped('cycle');

    const {tableMeta: targetMeta} = resolveTableOverride(liveTarget, generatedMeta);

    return {
      path: stepPath,
      fieldKey,
      table: liveTarget,
      tableMeta: targetMeta,
      skipped: null,
      children: plan(child, liveTarget, targetMeta, context, stepPath, [...visitedTableIds, liveTarget.id]),
    };
  });
}

/** Pre-order walk: the order the hook loads records in. */
export function flattenInclude(steps: ReadonlyArray<IncludeStep>): IncludeStep[] {
  return steps.flatMap(step => [step, ...flattenInclude(step.children)]);
}

/**
 * Replaces each row's link cells with the loaded rows they point at, deepest
 * links first so nested rows are complete before they're attached. `recordsOf`
 * returns what the hook loaded for a step (ignored for skipped steps).
 */
export function hydrate(
  rows: ReadonlyArray<Row>,
  steps: ReadonlyArray<IncludeStep>,
  recordsOf: (step: IncludeStep) => ReadonlyArray<SdkRecord>,
): void {
  for (const step of steps) {
    if (step.skipped !== null || !step.table || !step.tableMeta) continue;
    const {table, tableMeta} = step;

    const byId = new Map<string, SdkRecord>();
    for (const record of recordsOf(step)) byId.set(record.id, record);

    for (const row of rows) {
      const cell = row.fields[step.fieldKey];
      if (!Array.isArray(cell)) continue; // null, or not a link cell after all

      const linked: Row[] = [];
      for (const entry of cell as ReadonlyArray<unknown>) {
        // Right after a write a link entry can be a bare `{id}`; join by id only.
        const id = isSpecObject(entry) ? entry.id : undefined;
        const record = typeof id === 'string' ? byId.get(id) : undefined;
        if (record) linked.push(buildRow(record, table, tableMeta));
      }

      hydrate(linked, step.children, recordsOf);
      row.fields[step.fieldKey] = linked;
    }
  }
}

/** Why a step was skipped, worded for the console. */
function skipMessage(step: IncludeStep): string {
  const at = `include "${step.path.join('.')}"`;
  switch (step.skipped) {
    case 'not-a-link':
      return `${at}: not a link field; left as is.`;
    case 'depth-exceeded':
      return `${at}: includes go at most ${MAX_INCLUDE_DEPTH} links deep; left as is.`;
    case 'cycle':
      return `${at}: the target table is already on the include path; left as is.`;
    case 'no-target-meta':
      return `${at}: the generated file knows no table for this link (regenerate with airgen 0.4+); left as is.`;
    case 'target-unavailable':
      return `${at}: the linked table is deleted or hidden from this extension; left as is.`;
    default:
      return `${at}: skipped.`;
  }
}

/**
 * Logs each skipped step once (an `include` runs every render); `warned` is
 * the caller's memory of what it has already said. `unreachable` children
 * stay quiet: their parent already explained.
 */
export function warnSkipped(tableMeta: AirgenTableMeta, steps: ReadonlyArray<IncludeStep>, warned: Set<string>): void {
  for (const step of flattenInclude(steps)) {
    if (step.skipped === null || step.skipped === 'unreachable') continue;
    const key = `${tableMeta.id}:${step.path.join('.')}:${step.skipped}`;
    if (warned.has(key)) continue;
    warned.add(key);
    console.warn(`[airgen] ${tableMeta.name}: ${skipMessage(step)}`);
  }
}
