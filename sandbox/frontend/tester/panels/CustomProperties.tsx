/**
 * customProperties: a table picker in the Interface Designer's properties
 * panel. Pick a look-alike table (duplicate one of these tables in Airtable)
 * and every hook below reads/writes it, rebased by field name.
 */
import React from 'react';
import {createTypedHooks} from 'airgen/interface';
import {RecordTable} from '@airgen/ui';
import {airgenMeta, type TableLinkMap, type TableRecordMap, type TableWriteMap} from '../../airtable-schema';
import {meta, tableKeys} from '../dyn';
import {Code, Section, StatusBadge} from '../kit';

const overridable = tableKeys()[0];
const picked = createTypedHooks<TableRecordMap, TableWriteMap, TableLinkMap>(airgenMeta, {
  customProperties: {[overridable]: `airgen tester: ${meta.tables[overridable]?.name ?? 'table'}`},
});
const dynPicked = picked as unknown as {
  useTable: (key: string) => {id: string; name: string} | null;
  useRecords: (key: string) => Array<{id: string; name: string; fields: object}>;
  useMutations: (key: string) => {validation: {valid(): boolean; reason(): string}};
};

export function CustomProperties() {
  const table = dynPicked.useTable(overridable);
  const rows = dynPicked.useRecords(overridable);
  const mutations = dynPicked.useMutations(overridable);
  const generated = meta.tables[overridable];
  const repointed = table !== null && table.id !== generated.id;

  return (
    <Section
      title="customProperties"
      hint={
        <>
          Select this extension in the Interface Designer: its properties panel now has a picker labelled
          <Code>airgen tester: {generated.name}</Code>. Duplicate that table in Airtable and pick the copy.
        </>
      }
    >
      <ul className="m-0 pl-0 list-none mb-3">
        <li className="flex gap-2 py-0.5">
          <StatusBadge status={table ? 'pass' : 'fail'} /> resolved: {table ? `${table.name} (${table.id})` : 'nothing'}
        </li>
        <li className="flex gap-2 py-0.5">
          <StatusBadge status="info" /> {repointed ? 'repointed to a look-alike table' : 'using the generated table (no pick, or the pick is the original)'}
        </li>
        <li className="flex gap-2 py-0.5">
          <StatusBadge status={mutations.validation.valid() ? 'pass' : 'warn'} /> validation: {mutations.validation.reason() || 'ok'}
        </li>
      </ul>
      <RecordTable records={rows.slice(0, 15)} />
    </Section>
  );
}
