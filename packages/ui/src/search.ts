import Fuse from 'fuse.js';

/**
 * Fuzzy search for airgen's `query()`: pass as `search.matcher` to rank
 * records with fuse.js instead of airgen's default token match. Lives here,
 * not in airgen, so airgen keeps zero runtime dependencies — this package
 * already ships fuse.js for `Select`.
 *
 * Typed structurally (airgen's `SearchMatcher`): takes one text per record,
 * returns the matching indices, best match first.
 */
export type SearchMatcher = (texts: ReadonlyArray<string>, query: string) => ReadonlyArray<number>;

/** Same settings as `Select`'s search, so a query ranks the same everywhere. */
export const fuseMatcher: SearchMatcher = (texts, query) =>
  new Fuse(texts, {threshold: 0.4, ignoreLocation: true}).search(query).map(result => result.refIndex);
