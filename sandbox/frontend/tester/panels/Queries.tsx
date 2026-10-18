/** useQuery / query / groupRecords / search, with set-algebra checks that hold for any data. */
import React, {useState} from 'react';
import {cellText, groupRecords, query, type Filter} from 'airgen/interface';
import {Badge, ButtonToggle, Input, RecordTable, Select, fuseMatcher} from '@airgen/ui';
import {dyn, meta, tableKeys, type Row} from '../dyn';
import {check, CheckList, Code, Section, TablePicker, type Check} from '../kit';

type Op = 'is' | 'not' | 'anyOf' | 'noneOf' | 'empty' | 'notEmpty';
const OPS: Op[] = ['is', 'not', 'anyOf', 'noneOf', 'empty', 'notEmpty'];

export function Queries() {
  const [tableKey, setTableKey] = useState(tableKeys()[0] ?? '');
  return tableKey ? <QueriesFor key={tableKey} tableKey={tableKey} onPick={setTableKey} /> : null;
}

const ids = (rows: ReadonlyArray<Row>) => new Set(rows.map(r => r.id));
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(id => b.has(id));

function QueriesFor({tableKey, onPick}: {tableKey: string; onPick: (key: string) => void}) {
  const fieldKeys = Object.keys(meta.tables[tableKey].fields);
  const rows = dyn.useRecords(tableKey);
  const [field, setField] = useState(fieldKeys[0]);
  const [op, setOp] = useState<Op>('notEmpty');
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const [fuzzy, setFuzzy] = useState(false);
  const [groupBy, setGroupBy] = useState(fieldKeys.find(k => meta.tables[tableKey].fields[k].type === 'singleSelect') ?? fieldKeys[0]);

  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  const filter = (
    op === 'empty' || op === 'notEmpty'
      ? {field, op}
      : op === 'anyOf' || op === 'noneOf'
        ? {field, op, value: values}
        : {field, op, value: values[0] ?? ''}
  ) as Filter<Row>;

  const filtered = dyn.useQuery(tableKey, {where: [filter]});
  const searched = dyn.useQuery(tableKey, {
    search: {query: search, fields: fieldKeys, ...(fuzzy ? {matcher: fuseMatcher} : {})},
  });

  // Algebra that must hold on any data, for the picked field.
  const all = ids(rows);
  const empty = ids(query(rows, {where: [{field, op: 'empty'}]}));
  const notEmpty = ids(query(rows, {where: [{field, op: 'notEmpty'}]}));
  const sample = cellText(rows.find(r => r.fields[field] != null)?.fields[field]).split(', ')[0] ?? '';
  const is = ids(query(rows, {where: [{field, op: 'is', value: sample}]}));
  const not = ids(query(rows, {where: [{field, op: 'not', value: sample}]}));
  const both = ids(query(rows, {match: 'all', where: [{field, op: 'notEmpty'}, {field, op: 'is', value: sample}]}));
  const either = ids(query(rows, {match: 'any', where: [{field, op: 'empty'}, {field, op: 'notEmpty'}]}));
  const groups = groupRecords(rows, {fields: [groupBy]});
  const groupedIds = new Set(groups.flatMap(g => g.records.map(r => r.id)));

  const checks: Check[] = [
    check(`empty ∪ notEmpty = all (${field})`, sameSet(new Set([...empty, ...notEmpty]), all)),
    check('empty ∩ notEmpty = ∅', [...empty].every(id => !notEmpty.has(id))),
    check(`is "${sample}" ∪ not "${sample}" = all`, !sample || sameSet(new Set([...is, ...not]), all)),
    check(`is "${sample}" matches at least one record`, !sample || is.size > 0, 'value read from the data itself'),
    check('match: all ⊆ each filter', [...both].every(id => is.has(id) && notEmpty.has(id))),
    check('match: any of (empty, notEmpty) = all', sameSet(either, all)),
    check('useQuery(where) = query(useRecords, where)', sameSet(ids(filtered), ids(query(rows, {where: [filter]})))),
    check('empty search returns every record', search !== '' || searched.length === rows.length),
    check(`groupRecords(${groupBy}) covers every non-empty record`, [...notEmptyFor(rows, groupBy)].every(id => groupedIds.has(id))),
  ];

  const fieldOptions = fieldKeys.map(k => ({value: k, label: meta.tables[tableKey].fields[k].name ?? k}));
  return (
    <>
      <div className="mb-3">
        <TablePicker value={tableKey} onChange={onPick} />
      </div>
      <CheckList title="Query algebra" checks={checks} />

      <Section title="Filter" hint={<>Comma-separate values for anyOf/noneOf. Selects/links match by id or name.</>}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Select options={fieldOptions} value={field} onChange={setField} size="sm" searchable className="w-56" />
          <Select options={OPS.map(o => ({value: o, label: o}))} value={op} onChange={v => setOp(v as Op)} size="sm" className="w-32" />
          {op !== 'empty' && op !== 'notEmpty' && (
            <Input value={value} onChange={setValue} placeholder={sample || 'value'} size="sm" className="w-56" />
          )}
          <Badge opts={{name: `${filtered.length} / ${rows.length}`, color: 'blueLight2'}} />
        </div>
        <RecordTable records={filtered.slice(0, 15)} columns={[{id: 'n', header: 'name', accessor: (r: Row) => r.name}, field]} />
      </Section>

      <Section title="Search" hint="Default matcher is accent/case-insensitive tokens; fuzzy uses @airgen/ui's fuseMatcher.">
        <div className="flex items-center gap-2 mb-2">
          <Input value={search} onChange={setSearch} placeholder="Search all fields…" size="sm" className="w-72" />
          <ButtonToggle checked={fuzzy} onChange={v => setFuzzy(Boolean(v))} size="sm">
            fuzzy
          </ButtonToggle>
          <Badge opts={{name: `${searched.length} hits`, color: 'purpleLight2'}} />
        </div>
        <ol className="m-0 pl-5">
          {searched.slice(0, 10).map(r => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ol>
      </Section>

      <Section title="groupRecords" hint={<>Multi-value cells put a record in one group per value.</>}>
        <Select options={fieldOptions} value={groupBy} onChange={setGroupBy} size="sm" searchable className="w-56 mb-2" />
        <div className="flex flex-wrap gap-2">
          {groups.slice(0, 40).map(group => (
            <Badge key={group.key} opts={{name: `${group.values[0] ?? '(empty)'} · ${group.records.length}`, color: 'tealLight2'}} />
          ))}
        </div>
        <p className="text-sm text-gray-gray400">
          {groups.length} groups; <Code>{'by: name'}</Code>
        </p>
      </Section>
    </>
  );
}

function notEmptyFor(rows: ReadonlyArray<Row>, field: string): Set<string> {
  return ids(query(rows, {where: [{field, op: 'notEmpty'}]}));
}
