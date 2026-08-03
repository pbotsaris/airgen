import Fuse from 'fuse.js';
import type * as React from 'react';
import type {SelectOption, SelectGroup} from './types.js';

/**
 * Pure helpers behind Select's option list: text normalization, keyboard
 * index math, fuzzy filtering and header/divider flattening for grouped
 * options. React-free so they stay unit-testable without a DOM.
 */

export interface OptionHeaderEntry {
  type: 'header';
  key: string;
  label: React.ReactNode;
  color: string | null;
}
export interface OptionDividerEntry {
  type: 'divider';
}
export interface OptionItemEntry {
  type: 'option';
  opt: SelectOption;
  index: number;
}
export type OptionEntry = OptionHeaderEntry | OptionDividerEntry | OptionItemEntry;

/** Display text used for typeahead matching. */
export function normalizeOptionText(opt: SelectOption): string {
  if (opt.textValue) return opt.textValue;
  if (typeof opt.label === 'string') return opt.label;
  return opt.value;
}

/**
 * Text the search input matches against: `textValue` and a string `label`
 * combined, falling back to `value`.
 */
export function optionSearchText(opt: SelectOption): string {
  const parts = [opt.textValue, typeof opt.label === 'string' ? opt.label : null].filter(Boolean);
  return parts.length ? parts.join(' ') : opt.value;
}

/**
 * Next enabled option index from `start` walking in `dir`, wrapping around.
 * Out-of-range starts wrap too (start === length walks from 0, start === -1
 * from the end), so ArrowDown on the last option reaches the first.
 * Returns -1 when no enabled option exists.
 */
export function nextEnabledIndex(options: SelectOption[], start: number, dir: 1 | -1): number {
  const len = options.length;
  if (!len) return -1;
  const from = ((start % len) + len) % len;
  for (let step = 0; step < len; step++) {
    const idx = (from + step * dir + len) % len;
    if (!options[idx].disabled) return idx;
  }
  return -1;
}

export function indexByValue(options: SelectOption[], value?: string | null): number {
  if (value == null) return -1;
  return options.findIndex(o => o.value === value);
}

/**
 * Builds the Fuse index for `filterOptions`. Hoist into a `useMemo` keyed on
 * `options` so the index isn't rebuilt on every keystroke.
 */
export function createOptionFuse(options: SelectOption[]): Fuse<SelectOption> {
  return new Fuse(options, {
    keys: ['searchText'],
    getFn: (o: SelectOption) => optionSearchText(o),
    threshold: 0.4,
    ignoreLocation: true,
  });
}

/**
 * Fuzzy-filters options by `query` over `optionSearchText`, relevance-ordered.
 * Empty query returns `options` as-is. Pass a prebuilt `fuse` (from
 * `createOptionFuse`) to reuse the index across keystrokes; without one a
 * throwaway index is built per call.
 */
export function filterOptions(options: SelectOption[], query: string, fuse?: Fuse<SelectOption>): SelectOption[] {
  if (!query) return options;
  const index = fuse ?? createOptionFuse(options);
  return index.search(query).map(result => result.item);
}

/**
 * Caps the list at `maxItems` — but only while not searching, so a query can
 * always reach the full set.
 */
export function truncateOptions(options: SelectOption[], query: string, maxItems?: number): SelectOption[] {
  if (query || !maxItems || options.length <= maxItems) return options;
  return options.slice(0, maxItems);
}

/**
 * Flattens options into render entries, inserting group headers and dividers
 * when any option carries a `group` key.
 *
 * Groups keep the first-appearance order of their options (so relevance order
 * survives filtering); `groups` metadata only supplies header label/color.
 * Options without a `group` render first, headerless. Option entries are
 * numbered in display order — the keyboard-nav index space — and headers/
 * dividers carry no index, so they can never become active.
 */
export function buildOptionEntries(options: SelectOption[], groups?: SelectGroup[]): OptionEntry[] {
  if (!options.some(o => o.group != null)) {
    return options.map((opt, index) => ({type: 'option', opt, index}));
  }

  const buckets = new Map<string | undefined, SelectOption[]>();
  for (const opt of options) {
    const key = opt.group ?? undefined;
    const arr = buckets.get(key);
    if (arr) arr.push(opt);
    else buckets.set(key, [opt]);
  }

  const meta = new Map((groups ?? []).map(g => [g.key, g]));

  const entries: OptionEntry[] = [];
  let index = 0;
  let sectionIdx = 0;

  // ungrouped options first, headerless
  const ungrouped = buckets.get(undefined);
  if (ungrouped) {
    for (const opt of ungrouped) entries.push({type: 'option', opt, index: index++});
    buckets.delete(undefined);
    sectionIdx++;
  }

  // Only string keys remain: the undefined bucket was drained above.
  for (const [rawKey, opts] of buckets) {
    const key = rawKey as string;
    if (sectionIdx > 0) entries.push({type: 'divider'});
    const m = meta.get(key);
    entries.push({type: 'header', key, label: m?.label ?? key, color: m?.color ?? null});
    for (const opt of opts) entries.push({type: 'option', opt, index: index++});
    sectionIdx++;
  }

  return entries;
}

/**
 * The display-ordered options behind `buildOptionEntries` output — the array
 * keyboard navigation and selection index into.
 */
export function entryOptions(entries: OptionEntry[]): SelectOption[] {
  const out: SelectOption[] = [];
  for (const e of entries) if (e.type === 'option') out.push(e.opt);
  return out;
}
