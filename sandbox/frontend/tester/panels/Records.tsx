/** useRecords: every typed cell must equal the SDK's own getCellValue, field by field. */
import React, {useState} from 'react';
import {cellText} from 'airgen/interface';
import {RecordTable} from '@airgen/ui';
import {deepEqual, dyn, meta, preview, tableKeys, type Row} from '../dyn';
import {check, CheckList, Code, Section, TablePicker, type Check} from '../kit';

export function readChecks(tableKey: string, rows: ReadonlyArray<Row>, table: ReturnType<typeof dyn.useTable>): Check[] {
  const tableMeta = meta.tables[tableKey];
  const checks: Check[] = [];
  const mismatches: string[] = [];
  const extraKeys = new Set<string>();
  let compared = 0;

  for (const row of rows) {
    for (const key of Object.keys(row.fields)) if (!tableMeta.fields[key]) extraKeys.add(key);
    for (const [key, fieldMeta] of Object.entries(tableMeta.fields)) {
      const field = table?.getFieldByIdIfExists(fieldMeta.id);
      if (!field) {
        if (key in row.fields) mismatches.push(`${row.id}.${key}: hidden field is present`);
        continue;
      }
      const sdkValue = row.raw.getCellValue(field);
      const ours = row.fields[key];
      compared++;
      const empty = sdkValue === null || sdkValue === undefined;
      if (empty ? key in row.fields && ours != null : !deepEqual(ours, sdkValue)) {
        mismatches.push(`${row.id}.${key}: airgen ${preview(ours, 60)} ≠ SDK ${preview(sdkValue, 60)}`);
      }
    }
  }

  checks.push(check('rows have id, name and raw', rows.every(r => r.id && typeof r.name === 'string' && r.raw)));
  checks.push(
    check(
      'row.name === raw.name (primary field display string)',
      rows.every(r => r.name === r.raw.name),
      rows.find(r => r.name !== r.raw.name)?.id,
    ),
  );
  checks.push(check('row.id === raw.id', rows.every(r => r.id === r.raw.id)));
  checks.push(check('no field keys outside the generated meta', extraKeys.size === 0, [...extraKeys].join(', ')));
  checks.push(
    check(
      `every cell equals raw.getCellValue(field) (${compared} compared)`,
      mismatches.length === 0,
      <>
        {mismatches.length} mismatch(es): {mismatches.slice(0, 5).join(' · ')}
      </>,
    ),
  );
  checks.push(check('empty cells are absent, not null', rows.every(r => Object.values(r.fields).every(v => v != null))));
  return checks;
}

export function Records() {
  const [tableKey, setTableKey] = useState(tableKeys()[0] ?? '');
  return tableKey ? <RecordsFor key={tableKey} tableKey={tableKey} onPick={setTableKey} /> : <p>No tables.</p>;
}

function RecordsFor({tableKey, onPick}: {tableKey: string; onPick: (key: string) => void}) {
  const rows = dyn.useRecords(tableKey);
  const table = dyn.useTable(tableKey);
  const [limit, setLimit] = useState(25);
  const checks = readChecks(tableKey, rows, table);

  return (
    <>
      <Section title="useRecords" hint={<>Rows are <Code>{'{id, name, fields, raw}'}</Code>; fields keyed by sanitized name.</>}>
        <div className="flex items-center gap-3 mb-3">
          <TablePicker value={tableKey} onChange={onPick} />
          <span className="text-gray-gray400">{rows.length} records</span>
        </div>
        <CheckList title={`Read fidelity: ${tableKey}`} checks={checks} />
      </Section>
      <Section title="RecordTable (inferred columns)" hint="Default renderer: choices as pills, links/lookups as chips.">
        <RecordTable
          records={rows.slice(0, limit)}
          columns={[
            {id: '__name', header: 'name', accessor: (r: Row) => r.name},
            ...Object.keys(meta.tables[tableKey].fields).map(id => ({id, header: meta.tables[tableKey].fields[id].name ?? id})),
          ]}
          caption={
            rows.length > limit ? (
              <button type="button" onClick={() => setLimit(limit + 50)}>
                Showing {limit} of {rows.length} — show more
              </button>
            ) : undefined
          }
        />
      </Section>
      <Section title="cellText" hint="Display text for the first record, any cell shape.">
        <ul className="m-0 pl-4">
          {Object.entries(rows[0]?.fields ?? {}).map(([key, value]) => (
            <li key={key}>
              <Code>{key}</Code>: {cellText(value)}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
