/**
 * Filter, search, and group over `useRecords` rows — plain arrays in, plain
 * arrays out, so the same spec works in a `useMemo` or a test.
 *
 * Cells are compared through their "atoms": a select, link, or collaborator
 * matches by id, name, or email (ids never collide with realistic names, so
 * filtering by a durable id and by a readable name both just work); lookups
 * match by their values; numbers and booleans compare as strings; an array
 * cell matches when any element does.
 *
 * Search takes a pluggable matcher. The default is accent- and
 * case-insensitive token containment, which keeps airgen dependency-free; for
 * fuzzy ranking pass one built on fuse.js (`@airgen/ui` ships `fuseMatcher`).
 */

import {deaccent} from '../deaccent.js';

/** Anything with a `fields` object: `useRecords` rows, or plain objects in tests. */
export interface QueryableRecord {
  readonly fields: object;
}

export type FieldKey<R extends QueryableRecord> = keyof R['fields'] & string;

export type FilterValue = string | number | boolean;

export type Filter<R extends QueryableRecord> =
  | {readonly field: FieldKey<R>; readonly op: 'is' | 'not'; readonly value: FilterValue}
  | {readonly field: FieldKey<R>; readonly op: 'anyOf' | 'noneOf'; readonly value: ReadonlyArray<FilterValue>}
  | {readonly field: FieldKey<R>; readonly op: 'empty' | 'notEmpty'};

/**
 * Ranks `texts` against `query`: returns the indices of the matching texts,
 * best match first. Order is preserved as given when a matcher doesn't rank.
 */
export type SearchMatcher = (texts: ReadonlyArray<string>, query: string) => ReadonlyArray<number>;

export interface SearchSpec<R extends QueryableRecord> {
  readonly query: string;
  /** Fields whose text is searched, joined per record. */
  readonly fields: ReadonlyArray<FieldKey<R>>;
  readonly matcher?: SearchMatcher;
}

export interface QuerySpec<R extends QueryableRecord> {
  readonly where?: ReadonlyArray<Filter<R>>;
  /** Whether every filter (default) or any filter must match. */
  readonly match?: 'all' | 'any';
  /** Applied after the filters; results come back in the matcher's rank order. */
  readonly search?: SearchSpec<R>;
}

function cellOf<R extends QueryableRecord>(record: R, field: string): unknown {
  return (record.fields as {[key: string]: unknown})[field];
}

function isEmptyCell(cell: unknown): boolean {
  return cell === null || cell === undefined || cell === '' || (Array.isArray(cell) && cell.length === 0);
}

/** Every string a cell can be matched by. */
function atoms(cell: unknown): string[] {
  if (cell === null || cell === undefined || cell === '') return [];
  if (Array.isArray(cell)) return cell.flatMap(atoms);
  if (typeof cell !== 'object') return [String(cell)];

  const object = cell as {[key: string]: unknown};
  if ('linkedRecordId' in object && 'value' in object) return atoms(object.value);

  const found = ['id', 'name', 'email', 'text'].map(key => object[key]).filter(v => typeof v === 'string');
  return found.length > 0 ? (found as string[]) : [JSON.stringify(cell)];
}

function matchesFilter<R extends QueryableRecord>(record: R, filter: Filter<R>): boolean {
  const cell = cellOf(record, filter.field);

  switch (filter.op) {
    case 'empty':
      return isEmptyCell(cell);
    case 'notEmpty':
      return !isEmptyCell(cell);
    case 'is':
    case 'not': {
      const hit = atoms(cell).includes(String(filter.value));
      return filter.op === 'is' ? hit : !hit;
    }
    case 'anyOf':
    case 'noneOf': {
      const cellAtoms = atoms(cell);
      const hit = filter.value.some(value => cellAtoms.includes(String(value)));
      return filter.op === 'anyOf' ? hit : !hit;
    }
    default:
      return false;
  }
}

/** A cell as display text: names over ids, lookups by value, arrays comma-joined. */
export function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (Array.isArray(cell)) return cell.map(cellText).filter(Boolean).join(', ');
  if (typeof cell !== 'object') return String(cell);

  const object = cell as {[key: string]: unknown};
  if ('linkedRecordId' in object && 'value' in object) return cellText(object.value);
  for (const key of ['name', 'text', 'label', 'value', 'email', 'filename', 'id']) {
    if (typeof object[key] === 'string') return object[key] as string;
  }
  return '';
}

function fold(text: string): string {
  return deaccent(text).toLowerCase();
}

/** Default matcher: every whitespace-separated query token appears in the text, ignoring case and accents. */
export const containsMatcher: SearchMatcher = (texts, query) => {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  const indices: number[] = [];

  texts.forEach((text, index) => {
    const folded = fold(text);
    if (tokens.every(token => folded.includes(token))) indices.push(index);
  });

  return indices;
};

/** Records matching `spec`, in input order (or the matcher's rank order when searching). */
export function query<R extends QueryableRecord>(records: ReadonlyArray<R>, spec: QuerySpec<R> = {}): R[] {
  const filters = spec.where ?? [];
  const every = spec.match !== 'any';

  let result =
    filters.length === 0
      ? [...records]
      : records.filter(record =>
          every
            ? filters.every(filter => matchesFilter(record, filter))
            : filters.some(filter => matchesFilter(record, filter)),
        );

  const search = spec.search;
  if (search && search.query.trim() !== '') {
    const texts = result.map(record => search.fields.map(field => cellText(cellOf(record, field))).join(' '));
    const pool = result;
    result = (search.matcher ?? containsMatcher)(texts, search.query)
      .filter(index => index >= 0 && index < pool.length)
      .map(index => pool[index]);
  }

  return result;
}

export interface GroupSpec<R extends QueryableRecord> {
  readonly fields: ReadonlyArray<FieldKey<R>>;
  /** Group selects/links/collaborators by name (default) or by id. */
  readonly by?: 'name' | 'id';
}

export interface QueryGroup<R> {
  /** Stable key for the group (JSON of `values`), e.g. for React keys. */
  readonly key: string;
  /** One value per grouped field, in `fields` order; null for an empty cell. */
  readonly values: ReadonlyArray<string | null>;
  readonly records: R[];
}

/** The keys one cell contributes to grouping: one per element, deduped and sorted; [null] when empty. */
function groupKeys(cell: unknown, by: 'name' | 'id'): Array<string | null> {
  const order = by === 'name' ? ['name', 'email', 'id'] : ['id', 'name', 'email'];

  const keyOf = (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'object') return String(value);
    const object = value as {[key: string]: unknown};
    if ('linkedRecordId' in object && 'value' in object) return keyOf(object.value);
    for (const key of order) if (typeof object[key] === 'string') return object[key] as string;
    return JSON.stringify(value);
  };

  const items = Array.isArray(cell) ? cell : [cell];
  const keys = [...new Set(items.map(keyOf).filter((key): key is string => key !== null))].sort();
  return keys.length > 0 ? keys : [null];
}

function cartesian<T>(lists: ReadonlyArray<ReadonlyArray<T>>): T[][] {
  return lists.reduce<T[][]>((combos, list) => combos.flatMap(combo => list.map(item => [...combo, item])), [[]]);
}

/**
 * Groups records by one or more fields, in first-seen order. A multi-value
 * cell puts its record in one group per value, and grouping by several
 * fields groups by every combination of their values.
 */
export function groupRecords<R extends QueryableRecord>(
  records: ReadonlyArray<R>,
  spec: GroupSpec<R>,
): QueryGroup<R>[] {
  const groups = new Map<string, {values: Array<string | null>; records: R[]}>();
  const by = spec.by ?? 'name';

  for (const record of records) {
    const perField = spec.fields.map(field => groupKeys(cellOf(record, field), by));

    for (const values of cartesian(perField)) {
      const key = JSON.stringify(values);
      const group = groups.get(key);
      if (group) group.records.push(record);
      else groups.set(key, {values, records: [record]});
    }
  }

  return [...groups].map(([key, group]) => ({key, values: group.values, records: group.records}));
}
