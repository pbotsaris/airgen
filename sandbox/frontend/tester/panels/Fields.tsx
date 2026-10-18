/** useFields: one FieldInspector per generated field, live SDK field with meta fallback. */
import React, {useState} from 'react';
import {PillOption, Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@airgen/ui';
import {dyn, meta, tableKeys} from '../dyn';
import {check, CheckList, Code, Section, StatusBadge, TablePicker, type Check} from '../kit';

export function Fields() {
  const [tableKey, setTableKey] = useState(tableKeys()[0] ?? '');
  return tableKey ? <FieldsFor key={tableKey} tableKey={tableKey} onPick={setTableKey} /> : null;
}

function FieldsFor({tableKey, onPick}: {tableKey: string; onPick: (key: string) => void}) {
  const inspectors = dyn.useFields(tableKey);
  const table = dyn.useTable(tableKey);
  const tableMeta = meta.tables[tableKey];
  const checks: Check[] = [];

  checks.push(
    check(
      'one inspector per generated field',
      Object.keys(inspectors).sort().join() === Object.keys(tableMeta.fields).sort().join(),
    ),
  );
  for (const [key, inspector] of Object.entries(inspectors)) {
    const fieldMeta = tableMeta.fields[key];
    const live = table?.getFieldByIdIfExists(fieldMeta.id) ?? null;
    if (!live) {
      checks.push(check(`${key}: hidden field reports invalid`, !inspector.validation.valid(), undefined, 'fail'));
      continue;
    }
    checks.push(check(`${key}: name is the live name`, inspector.name === live.name, `${inspector.name} vs ${live.name}`));
    checks.push(check(`${key}: type is the live type`, inspector.type === live.type, `${inspector.type} vs ${live.type}`));
    checks.push(
      check(
        `${key}: isWritable agrees with SDK isComputed`,
        !(inspector.isWritable && live.isComputed),
        `writable but SDK says computed`,
      ),
    );
    if (inspector.choices.length > 0) {
      const liveChoices = (live.options?.choices as Array<{id: string}> | undefined) ?? [];
      checks.push(
        check(
          `${key}: choices are the live ones, in order`,
          inspector.choices.map(c => c.id).join() === liveChoices.map(c => c.id).join() || liveChoices.length === 0,
        ),
      );
      const first = inspector.choices[0];
      checks.push(
        check(`${key}: getChoiceByName is case-insensitive`, inspector.getChoiceByName(first.name.toUpperCase())?.id === first.id),
      );
    }
  }

  return (
    <>
      <Section title="useFields">
        <div className="mb-3">
          <TablePicker value={tableKey} onChange={onPick} />
        </div>
        <CheckList title={`Inspectors: ${tableKey}`} checks={checks} />
      </Section>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Live name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Write</TableHead>
            <TableHead>Choices</TableHead>
            <TableHead>Validation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.values(inspectors).map(inspector => (
            <TableRow key={inspector.fieldKey}>
              <TableCell>
                <Code>{inspector.fieldKey}</Code>
              </TableCell>
              <TableCell>{inspector.name}</TableCell>
              <TableCell>
                {inspector.type}
                {inspector.resultType && <span className="text-gray-gray400"> → {inspector.resultType}</span>}
              </TableCell>
              <TableCell>
                {inspector.isWritable ? `✏️ ${inspector.writeKind}` : <span className="text-gray-gray400">read-only</span>}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap gap-1">
                  {inspector.choices.slice(0, 12).map(choice => (
                    <PillOption key={choice.id} size="xs" opt={{value: choice.id, label: choice.name, color: choice.color}} />
                  ))}
                  {inspector.choices.length > 12 && <span>+{inspector.choices.length - 12}</span>}
                </span>
              </TableCell>
              <TableCell>
                {inspector.validation.valid() ? (
                  <StatusBadge status="pass" />
                ) : (
                  <span className="flex gap-1 items-center">
                    <StatusBadge status="warn" /> {inspector.validation.reason()}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
