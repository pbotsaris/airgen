/**
 * The runtime's public surface, re-exported by every entry point: the
 * non-hook factories the generated hooks bind, usable outside React and in
 * tests.
 */

export {BATCH_SIZE, createMutations} from './mutations.js';
export type {
  MutableTable,
  MutationFailure,
  MutationOptions,
  MutationResult,
  MutationSuccess,
  RecordRef,
} from './mutations.js';
export {FieldInspector, inspectField} from './fields.js';
export type {Choice, ChoiceOption, ParsedValue} from './fields.js';
export {formatValue, parseValue} from './format.js';
export type {FormatOptions, FormatSource, ParseResult} from './format.js';
export {cloneValues} from './clone.js';
export type {CloneOptions, RecordSource} from './clone.js';
export {aggregate, cellText, containsMatcher, groupRecords, query} from './queries.js';
export type {
  AggregateResult,
  AggregateSpec,
  Aggregation,
  FieldKey,
  Filter,
  FilterValue,
  GroupSpec,
  NumericFieldKey,
  QueryableRecord,
  QueryGroup,
  QuerySpec,
  SearchMatcher,
  SearchSpec,
} from './queries.js';
export {cellIds, cellNames, firstLinkedRecord, firstLookupValue, lookupValues} from './normalize.js';
export type {LookupEntry} from './normalize.js';
export {ValidationResult} from './validation.js';
export type {ValidationIssue, ValidationKind, ValidationLevel} from './validation.js';
export {findTable, resolveTableOverride} from './resolver.js';
export {MAX_INCLUDE_DEPTH, flattenInclude, hydrate, planInclude} from './include.js';
export type {IncludeSkipReason, IncludeStep} from './include.js';
export type {ResolvedTable} from './resolver.js';
export {customPropertyKey, tableCustomProperties} from './customProperties.js';
export type {CustomPropertiesConfig} from './customProperties.js';
export type {WriteKind} from '../field-types.js';
