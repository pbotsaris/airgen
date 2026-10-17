import normalize from "../airtable/normalize.js";

/**
 * Pure list operations — filter, sort, group — over any array, driven by accessor
 * functions. Nothing here knows about React or, except for the accessor factories at the
 * bottom, about Airtable; that is what makes the same three operations reusable across the
 * estimates popover, a future notes list, or anything else that renders a list of things.
 *
 * Compose them with `applyListView`, or hold their state with `useListView`
 * (`frontend/hooks/useListView.js`) and render controls with `<ListControls>`.
 */

/**
 * @template T
 * @typedef {(item: T) => any} Accessor
 */

/** @typedef {'asc' | 'desc'} SortDirection */

/**
 * @template T
 * @typedef {Object} ListGroup
 * @property {string | null} key - the group's key; `emptyKey` (default `null`) for items without one
 * @property {T[]} items
 */

/**
 * @template T
 * @typedef {Object} ListViewSpec
 * @property {{ accessor: Accessor<T>, allowed: Iterable<string> }} [filter] - keep items whose accessor value is in `allowed`; empty `allowed` keeps all
 * @property {{ accessor: Accessor<T>, direction?: SortDirection, nullsLast?: boolean }} [sort]
 * @property {{ accessor: Accessor<T>, order?: string[], emptyKey?: string | null } | null} [group] - `null` for a single flat group
 */

/**
 * @template T
 * @typedef {Object} ListViewResult
 * @property {T[]} items - filtered and sorted, flat
 * @property {ListGroup<T>[]} groups - the same items, grouped; a single `{key: null}` group when not grouping
 */

/** @param {any} v */
const isNil = (v) => v === null || v === undefined;

/**
 * Compare two non-nil values: numbers numerically, booleans as 0/1, everything else as
 * locale-aware strings.
 *
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function compareValues(a, b) {
   if (typeof a === "number" && typeof b === "number") return a - b;
   if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
   return String(a).localeCompare(String(b));
}

/**
 * A sorted copy of `items` ordered by `accessor(item)`. Stable: items that compare equal
 * keep their input order. Null/undefined values sink to the end (or float to the top with
 * `nullsLast: false`) regardless of direction.
 *
 * @template T
 * @param {T[]} items
 * @param {Accessor<T>} accessor
 * @param {{ direction?: SortDirection, nullsLast?: boolean }} [options]
 * @returns {T[]}
 */
export function sortBy(items, accessor, { direction = "asc", nullsLast = true } = {}) {
   const sign = direction === "desc" ? -1 : 1;
   const nilSign = nullsLast ? 1 : -1;

   return items
      .map((item, index) => ({ item, index, value: accessor(item) }))
      .sort((a, b) => {
         const aNil = isNil(a.value);
         const bNil = isNil(b.value);
         if (aNil && bNil) return a.index - b.index;
         if (aNil) return nilSign;
         if (bNil) return -nilSign;

         const cmp = compareValues(a.value, b.value) * sign;
         return cmp !== 0 ? cmp : a.index - b.index;
      })
      .map((entry) => entry.item);
}

/**
 * `items.filter(predicate)`, kept for API symmetry with the other operations.
 *
 * @template T
 * @param {T[]} items
 * @param {(item: T) => boolean} predicate
 * @returns {T[]}
 */
export function filterBy(items, predicate) {
   return items.filter(predicate);
}

/**
 * Items whose `accessor(item)` is one of `allowed`. An empty `allowed` means "no filter" and
 * returns `items` untouched — the natural meaning of a chip bar with nothing selected.
 *
 * @template T
 * @param {T[]} items
 * @param {Accessor<T>} accessor
 * @param {Iterable<string>} allowed
 * @returns {T[]}
 */
export function filterByValue(items, accessor, allowed) {
   const set = allowed instanceof Set ? allowed : new Set(allowed);
   if (set.size === 0) return items;
   return items.filter((item) => set.has(accessor(item)));
}

/**
 * Split `items` into ordered groups keyed by `keyAccessor(item)`.
 *
 * Group order: keys listed in `order` first, in that order; then any other key in the order
 * it is first seen; the empty group (items whose key is null/undefined/"") always last.
 * Empty groups are omitted. Within a group, items keep their input order — sort first,
 * then group.
 *
 * @template T
 * @param {T[]} items
 * @param {Accessor<T>} keyAccessor
 * @param {{ order?: string[], emptyKey?: string | null }} [options]
 * @returns {ListGroup<T>[]}
 */
export function groupBy(items, keyAccessor, { order = [], emptyKey = null } = {}) {
   /** @type {Map<string, T[]>} */
   const buckets = new Map();
   /** @type {T[]} */
   const empty = [];

   for (const item of items) {
      const raw = keyAccessor(item);
      if (isNil(raw) || raw === "") {
         empty.push(item);
         continue;
      }
      const key = String(raw);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(item);
      else buckets.set(key, [item]);
   }

   /** @type {ListGroup<T>[]} */
   const groups = [];
   for (const key of order) {
      const bucket = buckets.get(key);
      if (!bucket) continue;
      groups.push({ key, items: bucket });
      buckets.delete(key);
   }
   for (const [key, bucket] of buckets) groups.push({ key, items: bucket });
   if (empty.length > 0) groups.push({ key: emptyKey, items: empty });

   return groups;
}

/**
 * Filter, then sort, then group — the whole view in one call.
 *
 * @template T
 * @param {T[]} items
 * @param {ListViewSpec<T>} [spec]
 * @returns {ListViewResult<T>}
 */
export function applyListView(items, { filter, sort, group } = {}) {
   let result = items;
   if (filter) result = filterByValue(result, filter.accessor, filter.allowed);
   if (sort) result = sortBy(result, sort.accessor, { direction: sort.direction, nullsLast: sort.nullsLast });

   const groups = group
      ? groupBy(result, group.accessor, { order: group.order, emptyKey: group.emptyKey })
      : [{ key: null, items: result }];

   return { items: result, groups };
}

// ---------------------------------------------------------------------------
// Airtable record accessors
//
// The only lines that know what an Airtable record is. Each takes a resolved `Field` (which
// may be null when the schema did not resolve it) and returns an accessor for the
// operations above. All go through `normalize` so a null field reads as "no value".
// ---------------------------------------------------------------------------

/** @typedef {import('@airtable/blocks/interface/models').Field} Field */
/** @typedef {import('@airtable/blocks/interface/models').Record} AirtableRecord */

/**
 * The cell as a string, or `null` when empty.
 *
 * @param {Field | null} field
 * @returns {Accessor<AirtableRecord>}
 */
export const cellString = (field) => (record) => normalize.getCellValueAsString(record, field) || null;

/**
 * The cell as a number, or `null` when empty or not numeric.
 *
 * @param {Field | null} field
 * @returns {Accessor<AirtableRecord>}
 */
export const cellNumber = (field) => (record) => {
   const value = normalize.getCellValue(record, field);
   return typeof value === "number" ? value : null;
};

/**
 * The cell as epoch milliseconds, or `null` when empty or unparsable — so dates sort
 * numerically and invalid ones sink with the nulls.
 *
 * @param {Field | null} field
 * @returns {Accessor<AirtableRecord>}
 */
export const cellDate = (field) => (record) => {
   const value = normalize.getCellValue(record, field);
   if (!value) return null;
   const time = new Date(value).getTime();
   return Number.isNaN(time) ? null : time;
};

/**
 * The name of a single-select cell's choice, or `null` when empty.
 *
 * @param {Field | null} field
 * @returns {Accessor<AirtableRecord>}
 */
export const cellSelectName = (field) => (record) => {
   const value = normalize.getCellValue(record, field);
   if (!value) return null;
   return normalize.getSingleSelectValue(value)?.name ?? null;
};
