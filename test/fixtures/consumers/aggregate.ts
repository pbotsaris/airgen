/**
 * Consumer-style type assertions on `aggregate`. generator.test.js compiles
 * this next to the generated `airtable-schema.ts` under `tsc --strict`; every
 * `@ts-expect-error` must be a real error. Never run.
 */

import {aggregate, groupRecords} from 'airgen';
import type {LookupEntry, TypedRecord} from 'airgen';
import type {TableRecordMap} from './airtable-schema';

type Project = TypedRecord<TableRecordMap, 'Projects'>;

export function totals(projects: ReadonlyArray<Project>) {
  // Numbers, currency, percent, duration, rating, rollups and numeric formulas all sum.
  const result = aggregate(projects, {
    budget: {field: 'budget', op: 'sum'},
    avgCompletion: {field: 'completion', op: 'avg'},
    longest: {field: 'duration', op: 'max'},
    hours: {field: 'totalHours', op: 'sum'},
    count: {op: 'count'},
    owners: {field: 'owner', op: 'countDistinct'},
    noStatus: {field: 'status', op: 'countEmpty'},
  });
  const budget: number = result.budget;
  const count: number = result.count;
  const owners: number = result.owners;
  const avg: number | null = result.avgCompletion;
  // @ts-expect-error avg/min/max are null over no values
  const strictAvg: number = result.avgCompletion;
  // @ts-expect-error only spec names are in the result
  void result.nope;

  // @ts-expect-error a text field doesn't sum
  aggregate(projects, {bad: {field: 'name', op: 'sum'}});
  // @ts-expect-error nor does a lookup of strings
  aggregate(projects, {bad: {field: 'taskNames', op: 'avg'}});
  // @ts-expect-error nor a field whose type airgen couldn't resolve
  aggregate(projects, {bad: {field: 'brokenFormula', op: 'max'}});
  // @ts-expect-error counts still take the table's own field keys
  aggregate(projects, {bad: {field: 'nope', op: 'countFilled'}});

  // Per group: the result is a valid GroupTable summary as is.
  const perStatus = groupRecords(projects, {fields: ['status']}).map(group => ({
    status: group.values[0],
    ...aggregate(group.records, {budget: {field: 'budget', op: 'sum'}}),
  }));

  return {budget, count, owners, avg, strictAvg, perStatus};
}

/** A lookup of numbers is numeric too. */
interface Invoice {
  readonly id: string;
  readonly fields: {amounts?: Array<LookupEntry<number>>; label?: string};
}

export function invoiceTotal(invoices: ReadonlyArray<Invoice>): number {
  return aggregate(invoices, {total: {field: 'amounts', op: 'sum'}}).total;
}
