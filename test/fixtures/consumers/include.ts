/**
 * Consumer-style pins for `useRecords(key, {include})` against the mock base,
 * whose links form a 4-table chain (Projects → My Table → 2024 Plans →
 * My-Table) plus a cycle back from My Table to Projects. Positive lines must
 * compile; every `@ts-expect-error` must be a real error.
 */
import {createTypedHooks} from 'airgen';
import type {IncludedRecord, TypedRecord} from 'airgen';
import {airgenMeta, useQuery, useRecords} from './airtable-schema';
import type {TableLinkMap, TableRecordMap, TableWriteMap} from './airtable-schema';

// Every row carries the SDK's record name.
const plain: Array<TypedRecord<TableRecordMap, 'Projects'>> = useRecords('Projects');
export const plainName: string = plain[0].name;
// Without include, a link cell is still the SDK's {id, name} list.
export const plainLink: string | undefined = plain[0].fields.related?.[0].name;

// One link deep: the cell holds My Table rows.
const one = useRecords('Projects', {include: {related: true}});
export const oneName: string = one[0].name;
export const oneRelatedName: string | undefined = one[0].fields.related?.[0].fields.name;
export const oneRelatedRowName: string | undefined = one[0].fields.related?.[0].name;
export const oneBudget: number | undefined = one[0].fields.budget; // other fields unchanged
// A link the nested row didn't include stays an {id, name} list.
export const oneNestedPlain: string | undefined = one[0].fields.related?.[0].fields.plans?.[0].name;

// Two links deep.
const two = useRecords('Projects', {include: {related: {plans: true}}});
export const twoPlan: string | undefined = two[0].fields.related?.[0].fields.plans?.[0].fields.plan;
export const twoTyped: IncludedRecord<TableRecordMap, TableLinkMap, 'Projects', {related: {plans: true}}> = two[0];

// useQuery takes the same include; filters still name the plain row's fields.
const queried = useQuery('Projects', {include: {related: true}, where: [{field: 'related', op: 'notEmpty'}]});
export const queriedName: string | undefined = queried[0].fields.related?.[0].fields.name;

// Three links deep is refused.
// @ts-expect-error depth 3
useRecords('Projects', {include: {related: {plans: {other: true}}}});

// A link back to a table already on the path is refused.
// @ts-expect-error cycle: Projects → related → projects
useRecords('Projects', {include: {related: {projects: true}}});

// Only link fields are includable.
// @ts-expect-error not a link
useRecords('Projects', {include: {budget: true}});
// @ts-expect-error unknown key
useRecords('Projects', {include: {nope: true}});
// @ts-expect-error a link into a table outside the base is not includable
useRecords('Projects', {include: {tasks: true}});
// @ts-expect-error excess key beside a valid one
useRecords('Projects', {include: {related: true, budget: true}});
// @ts-expect-error nested excess key
useRecords('Projects', {include: {related: {plans: true, nope: true}}});
// @ts-expect-error only `true` or a nested spec
useRecords('Projects', {include: {related: false}});

// A file generated before 0.4.0 binds no TableLinkMap, so nothing is includable.
const legacy = createTypedHooks<TableRecordMap, TableWriteMap>(airgenMeta);
// @ts-expect-error include needs TableLinkMap
legacy.useRecords('Projects', {include: {related: true}});
export const legacyRows: Array<TypedRecord<TableRecordMap, 'Projects'>> = legacy.useRecords('Projects');
