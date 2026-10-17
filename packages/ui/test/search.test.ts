import {expect, test} from 'vitest';
import {fuseMatcher} from '../src/search.js';

const texts = ['São Paulo launch', 'Lisbon pilot', 'Berlin'];

test('fuseMatcher returns indices of fuzzy matches, best first', () => {
  expect(fuseMatcher(texts, 'lisbn')[0]).toBe(1); // a typo still ranks the right record first
  expect(fuseMatcher(texts, 'berlin')[0]).toBe(2);
  expect(fuseMatcher(texts, 'zzzzzz')).toEqual([]);
});

test('fuseMatcher ignores match location, like Select', () => {
  expect(fuseMatcher(['a very long title that ends with launch'], 'launch')).toEqual([0]);
});
