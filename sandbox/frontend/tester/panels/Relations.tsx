/**
 * include: hydrate links into the linked table's rows. The spec is built from
 * TableLinkMap/airgenMeta for whatever table is picked, and the component is
 * keyed by the spec, so the hook count only changes on remount (the
 * "static shape per call site" rule).
 */
import React, {useState} from 'react';
import {Badge, ButtonToggle, NestedRecordTable, RecordCellValue, RecordTable} from '@airgen/ui';
import {dyn, includableLinks, meta, nestedLevels, preview, tableKeys, widestInclude, type IncludeTree, type Loose, type Row} from '../dyn';
import {check, CheckList, Code, Section, TablePicker, type Check} from '../kit';

interface Stats {
  links: number;
  hydrated: number;
  dropped: number;
  problems: string[];
}

/** Walks rows against the spec and verifies every hydrated cell against the SDK's raw link cell. */
function verify(tableKey: string, rows: ReadonlyArray<Row>, spec: IncludeTree, table: ReturnType<typeof dyn.useTable>, stats: Stats, depth = 0) {
  const tableMeta = meta.tables[tableKey];
  for (const row of rows) {
    if (typeof row.name !== 'string') stats.problems.push(`${tableKey}/${row.id}: no name`);
    for (const [fieldKey, fieldMeta] of Object.entries(tableMeta.fields)) {
      if (fieldMeta.type !== 'multipleRecordLinks') continue;
      const cell = row.fields[fieldKey] as Array<{id: string; name?: string; fields?: object}> | undefined;
      const sub = spec[fieldKey];
      if (!sub) {
        if (cell?.some(entry => 'fields' in entry)) stats.problems.push(`${tableKey}.${fieldKey}: hydrated without being included`);
        continue;
      }
      // Only the root rows carry a raw record we can read the link cell from through `table`.
      const field = depth === 0 ? table?.getFieldByIdIfExists(fieldMeta.id) : null;
      const rawLinks = field ? ((row.raw.getCellValue(field) as Array<{id: string; name: string}> | null) ?? []) : null;
      const entries = cell ?? [];
      stats.links += rawLinks?.length ?? entries.length;
      stats.hydrated += entries.length;
      if (entries.some(e => !('fields' in e) || !('raw' in e))) stats.problems.push(`${tableKey}/${row.id}.${fieldKey}: entry is a stub, not a row`);
      if (rawLinks) {
        stats.dropped += rawLinks.length - entries.length;
        const rawIds = rawLinks.map(l => l.id);
        const order = entries.map(e => rawIds.indexOf(e.id));
        if (order.some(i => i < 0)) stats.problems.push(`${row.id}.${fieldKey}: hydrated id not in the raw link cell`);
        if (order.some((v, i) => i > 0 && v < order[i - 1])) stats.problems.push(`${row.id}.${fieldKey}: hydrated order differs from the link cell`);
        for (const entry of entries) {
          const stub = rawLinks.find(l => l.id === entry.id);
          if (stub && stub.name !== entry.name) stats.problems.push(`${row.id}.${fieldKey}: name "${entry.name}" ≠ link "${stub.name}"`);
        }
      }
      const target = includableLinks(tableKey).find(l => l.fieldKey === fieldKey)?.target;
      if (target && sub !== true) verify(target, entries as unknown as Row[], sub, null, stats, depth + 1);
    }
  }
}

function specText(spec: IncludeTree): string {
  return JSON.stringify(spec).replace(/"/g, '');
}

export function Relations() {
  const withLinks = tableKeys().filter(key => includableLinks(key).length > 0);
  const [tableKey, setTableKey] = useState(withLinks[0] ?? '');
  const [depth, setDepth] = useState('2');

  if (!tableKey) {
    return (
      <Section title="include" hint="No generated table has a link into another generated table. Grant two linked tables in the Interface Designer.">
        <span />
      </Section>
    );
  }
  const spec = widestInclude(tableKey, Number(depth));
  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <TablePicker value={tableKey} onChange={setTableKey} filter={key => withLinks.includes(key)} />
        <ButtonToggle
          options={[
            {value: '1', label: 'depth 1'},
            {value: '2', label: 'depth 2'},
          ]}
          value={depth}
          onChange={value => setDepth(String(value))}
          size="sm"
        />
      </div>
      <IncludeRun key={`${tableKey}:${specText(spec)}`} tableKey={tableKey} spec={spec} />
    </>
  );
}

function IncludeRun({tableKey, spec}: {tableKey: string; spec: IncludeTree}) {
  const plain = dyn.useRecords(tableKey);
  const rows = dyn.useRecords(tableKey, {include: spec});
  const queried = dyn.useQuery(tableKey, {include: spec});
  const table = dyn.useTable(tableKey);
  const [limit, setLimit] = useState(20);

  const stats: Stats = {links: 0, hydrated: 0, dropped: 0, problems: []};
  verify(tableKey, rows, spec, table, stats);
  const linkKeys = Object.keys(spec);
  const untouched = Object.keys(meta.tables[tableKey].fields).filter(key => !linkKeys.includes(key));

  const checks: Check[] = [
    check('same rows with and without include', rows.map(r => r.id).join() === plain.map(r => r.id).join()),
    check(
      'non-included cells are untouched',
      rows.every((row, i) => untouched.every(key => preview(row.fields[key], 1e6) === preview(plain[i]?.fields[key], 1e6))),
    ),
    check('every hydrated cell verified against the raw link cell', stats.problems.length === 0, stats.problems.slice(0, 6).join(' · ')),
    check('useQuery({include}) returns the same hydrated rows', queried.map(r => r.id).join() === rows.map(r => r.id).join()),
    {
      label: `${stats.hydrated}/${stats.links} root-level links hydrated, ${stats.dropped} dropped (not loaded / hidden)`,
      status: stats.dropped > 0 ? 'info' : 'pass',
    },
  ];

  return (
    <>
      <Section title="include" hint={<>useRecords(<Code>{`'${tableKey}'`}</Code>, {'{'}include: <Code>{specText(spec)}</Code>{'}'})</>}>
        <CheckList title="Hydration" checks={checks} />
      </Section>
      <Section title="NestedRecordTable" hint="One sub-table per included link, built from the same spec; root rows open by default.">
        <NestedRecordTable
          records={rows.slice(0, limit)}
          columns={[{id: 'record', header: meta.tables[tableKey].name, accessor: (r: Loose) => (r as Row).name}]}
          nested={nestedLevels(tableKey, spec)}
          defaultExpanded={1}
        />
      </Section>
      <Section title="Hydrated rows" hint="Linked rows render as their primary field; the second level as nested chips.">
        <RecordTable
          records={rows.slice(0, limit)}
          columns={[
            {id: 'record', header: meta.tables[tableKey].name, accessor: (r: Row) => r.name},
            ...linkKeys.map(fieldKey => ({
              id: fieldKey,
              header: `${meta.tables[tableKey].fields[fieldKey].name ?? fieldKey} (${(includableLinks(tableKey).find(l => l.fieldKey === fieldKey) ?? {target: '?'}).target})`,
              cell: ({value}: {value: unknown}) => <Hydrated value={value} spec={spec[fieldKey]} />,
            })),
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
    </>
  );
}

/** A hydrated cell: each linked row's name, plus its own included links one level down. */
function Hydrated({value, spec}: {value: unknown; spec: true | IncludeTree}) {
  const entries = (value as Row[] | undefined) ?? [];
  if (entries.length === 0) return <RecordCellValue value={null} />;
  return (
    <div className="flex flex-col gap-1">
      {entries.slice(0, 6).map(entry => (
        <div key={entry.id} className="flex flex-wrap items-center gap-1">
          <Badge variant="sm" opts={{name: entry.name || '(unnamed)', color: 'blueLight2'}} />
          <span className="text-sm text-gray-gray400">{Object.keys(entry.fields).length} fields</span>
          {spec !== true &&
            Object.keys(spec).map(nested => (
              <span key={nested} className="text-sm">
                {nested}: {((entry.fields[nested] as Row[] | undefined) ?? []).map(n => n.name).join(', ') || '—'}
              </span>
            ))}
        </div>
      ))}
      {entries.length > 6 && <span className="text-sm text-gray-gray400">+{entries.length - 6} more</span>}
    </div>
  );
}
