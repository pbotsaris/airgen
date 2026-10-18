/**
 * useMutations, end to end, on scratch records only: everything this suite
 * creates is tagged with SCRATCH in a text field, and cleanup removes only
 * those. Each step waits for the SDK to deliver the change back through
 * useRecords, so a pass means the round trip worked, not just the call.
 */
import React, {useRef, useState} from 'react';
import type {MutationResult} from 'airgen/interface';
import {Button, LoadingOverlay, useToast} from '@airgen/ui';
import {dyn, includableLinks, meta, preview, tableKeys, type Row} from '../dyn';
import {Code, Section, StatusBadge, TablePicker, type Status} from '../kit';

const SCRATCH = 'airgen-tester';

interface Step {
  label: string;
  status: Status | 'running';
  detail?: string;
  ms?: number;
}

function textFieldOf(tableKey: string, inspectors: ReturnType<typeof dyn.useFields>): string | null {
  const tableMeta = meta.tables[tableKey];
  const writableText = Object.keys(tableMeta.fields).filter(
    key => inspectors[key]?.isWritable && ['singleLineText', 'multilineText'].includes(tableMeta.fields[key].type),
  );
  const primary = writableText.find(key => tableMeta.fields[key].id === tableMeta.primaryFieldId);
  return primary ?? writableText[0] ?? null;
}

export function Writes() {
  const [tableKey, setTableKey] = useState(tableKeys()[0] ?? '');
  return tableKey ? <WritesFor key={tableKey} tableKey={tableKey} onPick={setTableKey} /> : null;
}

function WritesFor({tableKey, onPick}: {tableKey: string; onPick: (key: string) => void}) {
  const mutations = dyn.useMutations(tableKey);
  const inspectors = dyn.useFields(tableKey);
  const rows = dyn.useRecords(tableKey);
  const links = includableLinks(tableKey);
  const linkKey = links.find(l => inspectors[l.fieldKey]?.isWritable)?.fieldKey ?? null;
  const linkTarget = links.find(l => l.fieldKey === linkKey)?.target ?? tableKey;
  const targetRows = dyn.useRecords(linkTarget);
  const toast = useToast();

  const latest = useRef(rows);
  latest.current = rows;
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);

  const textKey = textFieldOf(tableKey, inspectors);
  const selectKey = Object.keys(inspectors).find(k => inspectors[k].isWritable && inspectors[k].writeKind === 'singleChoice' && inspectors[k].choices.length > 0) ?? null;
  const scratch = textKey ? rows.filter(r => String(r.fields[textKey] ?? '').startsWith(SCRATCH)) : [];
  const can = {create: mutations.can.create(), update: mutations.can.update(), delete: mutations.can.delete()};

  async function waitFor(predicate: (rows: Row[]) => boolean, timeoutMs = 8000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate(latest.current)) return true;
      await new Promise(r => setTimeout(r, 150));
    }
    return false;
  }

  async function run() {
    if (!textKey) return;
    setRunning(true);
    const log: Step[] = [];
    const push = (step: Step) => {
      log.push(step);
      setSteps([...log]);
    };
    const finish = (status: Status, detail?: string, started = Date.now()) => {
      log[log.length - 1] = {...log[log.length - 1], status, detail, ms: Date.now() - started};
      setSteps([...log]);
      return status === 'pass';
    };
    const describe = (r: MutationResult) => (r.ok ? `ids ${r.ids.join(', ')}` : `${r.error.message} (issues: ${r.issues.map(i => i.kind).join(', ') || 'none'})`);
    const tag = `${SCRATCH} ${new Date().toISOString().slice(11, 19)}`;
    const created: string[] = [];

    try {
      // 1. create
      let t = Date.now();
      push({label: `create({${textKey}: "${tag}"})`, status: 'running'});
      const made = await mutations.create({[textKey]: tag});
      if (!made.ok) return finish('fail', describe(made), t);
      created.push(...made.ids);
      const id = made.ids[0];
      const arrived = await waitFor(rs => rs.some(r => r.id === id && r.fields[textKey] === tag));
      if (!finish(arrived ? 'pass' : 'fail', arrived ? describe(made) : 'created, but never arrived through useRecords', t)) return;

      // 2. update a text cell
      t = Date.now();
      push({label: `update(record, '${textKey}', …)`, status: 'running'});
      const renamed = `${tag} (updated)`;
      const upd = await mutations.update(id, textKey, renamed);
      const seen = upd.ok && (await waitFor(rs => rs.some(r => r.id === id && r.fields[textKey] === renamed)));
      finish(seen ? 'pass' : 'fail', describe(upd), t);

      // 3. select by name, read back as {id, name, color}
      if (selectKey) {
        t = Date.now();
        const choice = inspectors[selectKey].choices[0];
        push({label: `update '${selectKey}' with {name: "${choice.name}"}`, status: 'running'});
        const sel = await mutations.updateFields(id, {[selectKey]: {name: choice.name}});
        const ok = sel.ok && (await waitFor(rs => (rs.find(r => r.id === id)?.fields[selectKey] as {id?: string} | undefined)?.id === choice.id));
        finish(ok ? 'pass' : 'fail', describe(sel), t);
      } else push({label: 'select write', status: 'info', detail: 'no writable single select on this table'});

      // 4. link, then confirm the include path can see it
      if (linkKey && targetRows[0]) {
        t = Date.now();
        push({label: `update '${linkKey}' → [{id: ${targetRows[0].id}}] (${linkTarget})`, status: 'running'});
        const lnk = await mutations.update(id, linkKey, [{id: targetRows[0].id}]);
        const ok =
          lnk.ok &&
          (await waitFor(rs => ((rs.find(r => r.id === id)?.fields[linkKey] as Array<{id: string; name?: string}> | undefined) ?? []).some(l => l.id === targetRows[0].id && typeof l.name === 'string')));
        finish(ok ? 'pass' : 'fail', describe(lnk), t);
      } else push({label: 'link write', status: 'info', detail: 'no writable link into a generated table'});

      // 5. clone: read values go back through convertTo
      t = Date.now();
      push({label: `clone(record, {overrides: {${textKey}: "… (clone)"}})`, status: 'running'});
      const source = latest.current.find(r => r.id === id);
      const cl = source ? await mutations.clone(source, {overrides: {[textKey]: `${tag} (clone)`}}) : null;
      if (cl?.ok) created.push(...cl.ids);
      const cloneOk = cl?.ok && (await waitFor(rs => rs.some(r => r.id === cl.ids[0])));
      const cloned = cl?.ok ? latest.current.find(r => r.id === cl.ids[0]) : undefined;
      const copiedEqual =
        cloned && source && Object.keys(source.fields).filter(k => k !== textKey && inspectors[k]?.isWritable).every(k => preview(cloned.fields[k], 1e6) === preview(source.fields[k], 1e6));
      finish(cloneOk ? (copiedEqual ? 'pass' : 'warn') : 'fail', cl ? `${describe(cl)}${copiedEqual === false ? ' — some writable cells differ from the source' : ''}` : 'source row missing', t);

      // 6. validation refuses before any SDK call
      t = Date.now();
      push({label: "update(record, '__notAField', 1) is refused, no throw", status: 'running'});
      const bogus = await mutations.update(id, '__notAField', 1);
      finish(!bogus.ok && bogus.ids.length === 0 ? 'pass' : 'fail', describe(bogus), t);
    } catch (error) {
      push({label: 'threw (the runtime should never throw)', status: 'fail', detail: String(error)});
    } finally {
      // 7. remove everything this run made
      const t = Date.now();
      if (created.length > 0) {
        push({label: `removeMany(${created.length} scratch records)`, status: 'running'});
        const rm = await mutations.removeMany(created);
        const gone = rm.ok && (await waitFor(rs => created.every(id => !rs.some(r => r.id === id))));
        finish(gone ? 'pass' : 'fail', describe(rm), t);
      }
      setRunning(false);
      const failed = log.filter(s => s.status === 'fail').length;
      if (failed > 0) toast.error(`Write suite: ${failed} step(s) failed`);
      else toast.info('Write suite passed');
    }
  }

  async function cleanup() {
    const result = await mutations.removeMany(scratch);
    if (result.ok) toast.info(`Removed ${result.ids.length} scratch record(s)`);
    else toast.error(result.error.message);
  }

  return (
    <>
      <div className="mb-3">
        <TablePicker value={tableKey} onChange={onPick} />
      </div>
      <Section
        title="Permissions and validation"
        hint="In an interface, writes need the extension's 'Edit / Add / Delete records inline' toggles in the Interface Designer."
      >
        <ul className="m-0 pl-0 list-none">
          <li className="flex gap-2 py-0.5">
            <StatusBadge status={mutations.validation.valid() ? 'pass' : 'fail'} /> table validation {mutations.validation.reason()}
          </li>
          {(['create', 'update', 'delete'] as const).map(op => (
            <li key={op} className="flex gap-2 py-0.5">
              <StatusBadge status={can[op].hasPermission ? 'pass' : 'warn'} /> can.{op}() {can[op].reasonDisplayString ?? ''}
            </li>
          ))}
          <li className="flex gap-2 py-0.5">
            <StatusBadge status={textKey ? 'pass' : 'warn'} /> scratch tag field: {textKey ? <Code>{textKey}</Code> : 'none (needs a writable text field)'}
          </li>
        </ul>
      </Section>
      <Section title="Write suite" hint={<>create → update → select → link → clone → refused write → removeMany. Records are tagged <Code>{SCRATCH}</Code>.</>}>
        <div className="flex gap-2 mb-3">
          <Button onClick={run} disabled={running || !textKey}>
            Run write suite on {meta.tables[tableKey].name}
          </Button>
          <Button variant="destructive" onClick={cleanup} disabled={running || scratch.length === 0}>
            Remove {scratch.length} leftover scratch record(s)
          </Button>
        </div>
        <div className="relative min-h-[40px]">
          <LoadingOverlay pending={running} label="Writing…" />
          <ol className="m-0 pl-0 list-none">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 py-1 border-t border-gray-gray100 dark:border-gray-gray700">
                {step.status === 'running' ? <span className="w-10">…</span> : <StatusBadge status={step.status} />}
                <div>
                  <Code>{step.label}</Code> {step.ms != null && <span className="text-sm text-gray-gray400">{step.ms} ms</span>}
                  {step.detail && <div className="text-sm text-gray-gray400 break-all">{step.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>
    </>
  );
}
