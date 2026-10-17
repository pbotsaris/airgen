/**
 * Read helpers for cell shapes `useRecords` hands back typed but awkward to
 * consume: lookups wrap every value, and links/selects/collaborators are
 * arrays of objects when a caller usually wants ids or names. All are total —
 * empty or malformed input yields `[]` / `null`, never a throw.
 */

/** One entry of a lookup cell, as the SDK reads it. */
export interface LookupEntry<T> {
  readonly linkedRecordId: string;
  readonly value: T;
}

function isLookupEntry(value: unknown): value is LookupEntry<unknown> {
  return typeof value === 'object' && value !== null && 'linkedRecordId' in value && 'value' in value;
}

/**
 * The values of a lookup cell, in linked-record order, empty ones dropped.
 * The SDK reads a lookup as `Array<{linkedRecordId, value}>`; bare values are
 * accepted too, so this works on either shape.
 */
export function lookupValues<T>(cell: ReadonlyArray<LookupEntry<T>> | null | undefined): T[];
export function lookupValues<T>(cell: ReadonlyArray<T> | null | undefined): T[];
export function lookupValues(cell: ReadonlyArray<unknown> | null | undefined): unknown[] {
  if (!Array.isArray(cell)) return [];
  return cell
    .map(entry => (isLookupEntry(entry) ? entry.value : entry))
    .filter(value => value !== null && value !== undefined);
}

/** First value of a lookup cell, or null. A lookup through one link is still an array of one. */
export function firstLookupValue<T>(cell: ReadonlyArray<LookupEntry<T>> | null | undefined): T | null;
export function firstLookupValue<T>(cell: ReadonlyArray<T> | null | undefined): T | null;
export function firstLookupValue(cell: ReadonlyArray<unknown> | null | undefined): unknown {
  return lookupValues(cell)[0] ?? null;
}

type Identified = {readonly id: string};
type Named = {readonly name?: string};

function asList<T>(cell: T | ReadonlyArray<T> | null | undefined): ReadonlyArray<T> {
  if (cell === null || cell === undefined) return [];
  return Array.isArray(cell) ? cell : [cell as T];
}

/**
 * Ids of a link, select, or collaborator cell (single or multiple). Tolerates
 * the `[{id}]` a link briefly reads as right after a write, before the
 * server echoes names back.
 */
export function cellIds(cell: Identified | ReadonlyArray<Identified> | null | undefined): string[] {
  return asList(cell)
    .map(item => item?.id)
    .filter((id): id is string => typeof id === 'string');
}

/** Names of a link, select, or collaborator cell; entries without a name are skipped. */
export function cellNames(cell: Named | ReadonlyArray<Named> | null | undefined): string[] {
  return asList(cell)
    .map(item => item?.name)
    .filter((name): name is string => typeof name === 'string');
}

/** First linked record of a link cell, or null — for links that only ever hold one. */
export function firstLinkedRecord<T extends Identified>(cell: ReadonlyArray<T> | null | undefined): T | null {
  return asList(cell)[0] ?? null;
}
