import * as React from "react";
import { applyListView } from "../utils/listOps.js";

/**
 * Filter / sort / group state for a list, applied with the pure operations in
 * `frontend/utils/listOps.js`. Pair it with `<ListControls>` for the UI.
 *
 * Accessors and `group.order` are dependencies of the memo: build them with `useMemo` in
 * the caller so the view is not recomputed every render.
 */

/** @typedef {import('../utils/listOps.js').SortDirection} SortDirection */

/**
 * @template T
 * @typedef {import('../utils/listOps.js').Accessor<T>} Accessor
 */

/**
 * @template T
 * @typedef {import('../utils/listOps.js').ListGroup<T>} ListGroup
 */

/**
 * @template T
 * @typedef {Object} ListViewOptions
 * @property {{ accessor: Accessor<T>, initial?: string[] }} [filter] - keep items whose value is selected; nothing selected keeps all
 * @property {{ accessor: Accessor<T>, initial?: SortDirection, nullsLast?: boolean }} [sort]
 * @property {{ accessor: Accessor<T>, order?: string[], emptyKey?: string | null, initial?: boolean }} [group] - `initial` is whether grouping starts on (default true)
 */

/**
 * @template T
 * @typedef {Object} ListView
 * @property {T[]} items - filtered and sorted, flat
 * @property {ListGroup<T>[]} groups - the same items grouped; one `{key: null}` group when grouping is off
 * @property {{ value: string[], active: boolean, toggle: (v: string) => void, set: (v: string[]) => void, clear: () => void }} filter
 * @property {{ direction: SortDirection, toggle: () => void, set: (d: SortDirection) => void }} sort
 * @property {{ enabled: boolean, toggle: () => void, set: (on: boolean) => void }} group
 */

/**
 * @template T
 * @param {T[]} items
 * @param {ListViewOptions<T>} options
 * @returns {ListView<T>}
 */
export function useListView(items, { filter, sort, group } = {}) {
   const [selected, setSelected] = React.useState(/** @type {string[]} */ (filter?.initial ?? []));
   const [direction, setDirection] = React.useState(/** @type {SortDirection} */ (sort?.initial ?? "asc"));
   const [grouped, setGrouped] = React.useState(group?.initial ?? true);

   const filterAccessor = filter?.accessor;
   const sortAccessor = sort?.accessor;
   const nullsLast = sort?.nullsLast;
   const groupAccessor = group?.accessor;
   const groupOrder = group?.order;
   const emptyKey = group?.emptyKey;

   const view = React.useMemo(
      () =>
         applyListView(items, {
            filter: filterAccessor ? { accessor: filterAccessor, allowed: selected } : undefined,
            sort: sortAccessor ? { accessor: sortAccessor, direction, nullsLast } : undefined,
            group: grouped && groupAccessor ? { accessor: groupAccessor, order: groupOrder, emptyKey } : null,
         }),
      [items, filterAccessor, selected, sortAccessor, direction, nullsLast, grouped, groupAccessor, groupOrder, emptyKey],
   );

   const toggleFilter = React.useCallback(
      /** @param {string} value */
      (value) =>
         setSelected((/** @type {string[]} */ prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
         ),
      [],
   );
   const clearFilter = React.useCallback(() => setSelected([]), []);
   const toggleDirection = React.useCallback(
      () => setDirection((/** @type {SortDirection} */ d) => (d === "asc" ? "desc" : "asc")),
      [],
   );
   const toggleGrouped = React.useCallback(() => setGrouped((/** @type {boolean} */ g) => !g), []);

   return {
      items: view.items,
      groups: view.groups,
      filter: { value: selected, active: selected.length > 0, toggle: toggleFilter, set: setSelected, clear: clearFilter },
      sort: { direction, toggle: toggleDirection, set: setDirection },
      group: { enabled: grouped, toggle: toggleGrouped, set: setGrouped },
   };
}
