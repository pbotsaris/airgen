/** The generated file against the live base: meta version, tables, link graph. */
import React from 'react';
import {META_VERSION} from 'airgen/interface';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@airgen/ui';
import {dyn, includableLinks, meta, tableKeyById, tableKeys} from '../dyn';
import {check, CheckList, Code, Section, type Check} from '../kit';

function TableRowCheck({tableKey, onChecks}: {tableKey: string; onChecks: (c: Check[]) => void}) {
  const table = dyn.useTable(tableKey);
  const records = dyn.useRecords(tableKey);
  const tableMeta = meta.tables[tableKey];
  const fieldMetas = Object.values(tableMeta.fields);
  const live = fieldMetas.filter(f => table?.getFieldByIdIfExists(f.id));
  const links = includableLinks(tableKey);
  const dangling = fieldMetas.filter(f => f.type === 'multipleRecordLinks' && !tableKeyById(f.linkedTableId));

  const checks: Check[] = [
    check(`${tableKey}: table resolves by ID`, table !== null, `useTable('${tableKey}') returned null`),
    check(
      `${tableKey}: every generated field is live`,
      live.length === fieldMetas.length,
      `${fieldMetas.length - live.length} field(s) hidden or deleted`,
      'warn',
    ),
    check(
      `${tableKey}: primaryFieldId matches the SDK`,
      !table || tableMeta.primaryFieldId === table.primaryField.id,
      `meta ${tableMeta.primaryFieldId} vs live ${table?.primaryField.id}`,
    ),
    check(
      `${tableKey}: every link field carries linkedTableId (meta v3)`,
      fieldMetas.filter(f => f.type === 'multipleRecordLinks').every(f => typeof f.linkedTableId === 'string'),
    ),
  ];
  React.useEffect(() => onChecks(checks), [JSON.stringify(checks.map(c => c.status))]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TableRow>
      <TableCell>
        <strong>{tableMeta.name}</strong> <Code>{tableKey}</Code>
      </TableCell>
      <TableCell>
        <Code>{tableMeta.id}</Code>
      </TableCell>
      <TableCell className="text-right">
        {live.length}/{fieldMetas.length}
      </TableCell>
      <TableCell className="text-right">{records.length}</TableCell>
      <TableCell>
        {links.map(l => `${l.fieldKey} → ${l.target}`).join(', ') || '—'}
        {dangling.length > 0 && (
          <div className="text-sm text-gray-gray400">
            not includable (target not granted): {dangling.map(f => f.name ?? f.id).join(', ')}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function Overview() {
  const [byTable, setByTable] = React.useState<{[k: string]: Check[]}>({});
  const keys = tableKeys();

  const metaChecks: Check[] = [
    check(`meta version is ${META_VERSION}`, meta.version === META_VERSION, `got ${meta.version}`),
    check('at least one table generated', keys.length > 0),
    check(
      'at least one includable link (needed to test include)',
      keys.some(k => includableLinks(k).length > 0),
      'Grant two linked tables to the extension in the Interface Designer',
      'warn',
    ),
  ];

  return (
    <>
      <Section title="Generated file" hint={<>baseId <Code>{meta.baseId}</Code> · signature <Code>{meta.signature}</Code></>}>
        <CheckList title="Meta" checks={metaChecks} />
        <CheckList title="Tables resolve live" checks={Object.values(byTable).flat()} />
      </Section>
      <Section title="Tables and links" hint="Fields = live / generated. Links are what TableLinkMap offers to include.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>ID</TableHead>
              <TableHead className="text-right">Fields</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead>Includable links</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map(key => (
              <TableRowCheck key={key} tableKey={key} onChecks={c => setByTable(prev => ({...prev, [key]: c}))} />
            ))}
          </TableBody>
        </Table>
      </Section>
    </>
  );
}
