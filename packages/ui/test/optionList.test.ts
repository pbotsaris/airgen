import {describe, expect, it, vi} from 'vitest';
import Fuse from 'fuse.js';
import {
  normalizeOptionText,
  optionSearchText,
  nextEnabledIndex,
  indexByValue,
  createOptionFuse,
  filterOptions,
  truncateOptions,
  buildOptionEntries,
  entryOptions,
} from '../src/optionList.js';
import type {SelectOption} from '../src/types.js';

const opts = (values: Array<string | [string, Partial<SelectOption>]>): SelectOption[] =>
  values.map(v => (typeof v === 'string' ? {value: v, label: v} : {value: v[0], label: v[0], ...v[1]}));

describe('text helpers', () => {
  it('normalizeOptionText prefers textValue, then string label, then value', () => {
    expect(normalizeOptionText({value: 'v', label: 'Label', textValue: 'tv'})).toBe('tv');
    expect(normalizeOptionText({value: 'v', label: 'Label'})).toBe('Label');
    expect(normalizeOptionText({value: 'v', label: null})).toBe('v');
  });

  it('optionSearchText joins textValue and string label, falls back to value', () => {
    expect(optionSearchText({value: 'v', label: 'Label', textValue: 'tv'})).toBe('tv Label');
    expect(optionSearchText({value: 'v', label: null})).toBe('v');
  });
});

describe('nextEnabledIndex', () => {
  const list = opts(['a', ['b', {disabled: true}], 'c']);

  it('wraps forward past the end (ArrowDown on the last option)', () => {
    expect(nextEnabledIndex(list, 3, 1)).toBe(0);
  });

  it('wraps backward past the start (ArrowUp on the first option)', () => {
    expect(nextEnabledIndex(list, -1, -1)).toBe(2);
  });

  it('skips disabled options in both directions', () => {
    expect(nextEnabledIndex(list, 1, 1)).toBe(2);
    expect(nextEnabledIndex(list, 1, -1)).toBe(0);
  });

  it('returns -1 for empty and all-disabled lists', () => {
    expect(nextEnabledIndex([], 0, 1)).toBe(-1);
    expect(nextEnabledIndex(opts([['a', {disabled: true}], ['b', {disabled: true}]]), 0, 1)).toBe(-1);
  });
});

describe('filtering', () => {
  const list = opts(['Apple', 'Banana', 'Cherry']);

  it('indexByValue finds by value and handles null', () => {
    expect(indexByValue(list, 'Banana')).toBe(1);
    expect(indexByValue(list, null)).toBe(-1);
    expect(indexByValue(list, 'missing')).toBe(-1);
  });

  it('empty query returns the same array', () => {
    expect(filterOptions(list, '')).toBe(list);
  });

  it('fuzzy-matches via optionSearchText', () => {
    expect(filterOptions(list, 'appl').map(o => o.value)).toEqual(['Apple']);
    const withText = opts([['x1', {label: 'First', textValue: 'alpha'}], ['x2', {label: 'Second'}]]);
    expect(filterOptions(withText, 'alpha').map(o => o.value)).toEqual(['x1']);
  });

  it('reuses a prebuilt Fuse index across calls', () => {
    const fuse = createOptionFuse(list);
    const searchSpy = vi.spyOn(Fuse.prototype, 'search');
    expect(filterOptions(list, 'ban', fuse).map(o => o.value)).toEqual(['Banana']);
    expect(filterOptions(list, 'cher', fuse).map(o => o.value)).toEqual(['Cherry']);
    expect(searchSpy).toHaveBeenCalledTimes(2);
    searchSpy.mockRestore();
  });

  it('truncateOptions caps only while not searching', () => {
    expect(truncateOptions(list, '', 2)).toHaveLength(2);
    expect(truncateOptions(list, 'a', 2)).toHaveLength(3);
    expect(truncateOptions(list, '', undefined)).toBe(list);
  });
});

describe('buildOptionEntries', () => {
  it('flat list gets plain numbered entries', () => {
    const entries = buildOptionEntries(opts(['a', 'b']));
    expect(entries).toEqual([
      {type: 'option', opt: expect.objectContaining({value: 'a'}), index: 0},
      {type: 'option', opt: expect.objectContaining({value: 'b'}), index: 1},
    ]);
  });

  it('grouped list renders ungrouped first, then headers/dividers, with continuous indexes', () => {
    const list = opts([
      'solo',
      ['a1', {group: 'A'}],
      ['b1', {group: 'B'}],
      ['a2', {group: 'A'}],
    ]);
    const entries = buildOptionEntries(list, [{key: 'A', label: 'Group A', color: 'blueBright'}]);
    expect(entries.map(e => e.type)).toEqual(['option', 'divider', 'header', 'option', 'option', 'divider', 'header', 'option']);
    const headers = entries.filter(e => e.type === 'header');
    expect(headers[0]).toMatchObject({key: 'A', label: 'Group A', color: 'blueBright'});
    expect(headers[1]).toMatchObject({key: 'B', label: 'B', color: null});
    expect(entryOptions(entries).map(o => o.value)).toEqual(['solo', 'a1', 'a2', 'b1']);
    const indexes = entries.filter(e => e.type === 'option').map(e => e.index);
    expect(indexes).toEqual([0, 1, 2, 3]);
  });
});
