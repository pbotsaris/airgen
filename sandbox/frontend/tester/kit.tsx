/** Visual-feedback primitives shared by every panel: checks, sections, the table picker. */
import React, {useState} from 'react';
import {Badge, Caret, Select, Text} from '@airgen/ui';
import {meta, tableKeys} from './dyn';

export type Status = 'pass' | 'fail' | 'warn' | 'info';

export interface Check {
  label: string;
  status: Status;
  detail?: React.ReactNode;
}

const STATUS_COLOR: {[S in Status]: string} = {
  pass: 'greenBright',
  fail: 'redBright',
  warn: 'yellowBright',
  info: 'blueLight1',
};

const STATUS_TEXT: {[S in Status]: string} = {pass: 'PASS', fail: 'FAIL', warn: 'WARN', info: 'INFO'};

export const check = (label: string, ok: boolean, detail?: React.ReactNode, onFail: Status = 'fail'): Check => ({
  label,
  status: ok ? 'pass' : onFail,
  detail: ok ? undefined : detail,
});

export function StatusBadge({status}: {status: Status}) {
  return <Badge variant="sm" opts={{name: STATUS_TEXT[status], color: STATUS_COLOR[status]}} />;
}

export function summarize(checks: ReadonlyArray<Check>) {
  const count = (status: Status) => checks.filter(c => c.status === status).length;
  return {pass: count('pass'), fail: count('fail'), warn: count('warn'), info: count('info')};
}

/** A collapsible list of checks with a pass/fail summary in its header. */
export function CheckList({title, checks}: {title: string; checks: ReadonlyArray<Check>}) {
  const counts = summarize(checks);
  const [open, setOpen] = useState(counts.fail > 0 || counts.warn > 0);
  const overall: Status = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';

  return (
    <div className="rounded-md border border-gray-gray200 dark:border-gray-gray600 mb-3" data-testid="checklist">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-transparent border-0 cursor-pointer text-inherit"
      >
        <Caret open={open} size="sm" direction={open ? 'down' : 'right'} />
        <StatusBadge status={overall} />
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-sm text-gray-gray400">
          {counts.pass} pass · {counts.fail} fail · {counts.warn} warn
          {counts.info > 0 && ` · ${counts.info} info`}
        </span>
      </button>
      {open && (
        <ul className="m-0 px-3 pb-2 list-none">
          {checks.length === 0 && <li className="text-gray-gray400 py-1">No checks (no data to check against).</li>}
          {checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 py-1 border-t border-gray-gray100 dark:border-gray-gray700">
              <StatusBadge status={c.status} />
              <div className="min-w-0">
                <div>{c.label}</div>
                {c.detail != null && <div className="text-sm text-gray-gray400 break-all">{c.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Section({title, hint, children}: {title: string; hint?: React.ReactNode; children: React.ReactNode}) {
  return (
    <section className="mb-6">
      <Text variant="heading" as="h3" className="mb-1">
        {title}
      </Text>
      {hint && (
        <Text variant="muted" as="p" className="mb-2">
          {hint}
        </Text>
      )}
      {children}
    </section>
  );
}

export function TablePicker({
  value,
  onChange,
  filter,
}: {
  value: string;
  onChange: (key: string) => void;
  filter?: (key: string) => boolean;
}) {
  const options = tableKeys()
    .filter(key => !filter || filter(key))
    .map(key => ({value: key, label: `${meta.tables[key].name} (${key})`}));
  return <Select options={options} value={value} onChange={onChange} size="sm" className="w-72" />;
}

export function Code({children}: {children: React.ReactNode}) {
  return <code className="font-mono text-sm px-1 rounded-sm bg-gray-gray75 dark:bg-gray-gray700">{children}</code>;
}
