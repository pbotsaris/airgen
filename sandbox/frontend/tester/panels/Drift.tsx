/** useSchemaDrift: the live schema against the airgenMeta baked into the generated file. */
import React from 'react';
import {useSchemaDrift} from '../../airtable-schema';
import {Code, Section, StatusBadge, type Status} from '../kit';

const SEVERITY: {[s: string]: Status} = {breaking: 'fail', warning: 'warn', info: 'info'};

export function Drift() {
  const drift = useSchemaDrift();
  return (
    <Section
      title="useSchemaDrift"
      hint={
        <>
          While <Code>npx airgen</Code> runs, the observer regenerates on every schema change, so drift clears itself. To see
          findings: stop the daemon, then rename a field (info), delete a choice (warning) or change a field type (breaking).
        </>
      }
    >
      <div className="flex gap-2 items-center mb-2">
        <StatusBadge status={drift.ok ? 'pass' : drift.counts.breaking > 0 ? 'fail' : 'warn'} />
        {drift.ok ? 'No drift: the generated file matches the live base.' : `${drift.counts.breaking} breaking · ${drift.counts.warning} warning · ${drift.counts.info} info`}
      </div>
      <ul className="m-0 pl-0 list-none">
        {drift.findings.map(finding => (
          <li key={`${finding.kind}:${finding.tableKey}:${finding.fieldKey ?? ''}`} className="flex gap-2 py-1">
            <StatusBadge status={SEVERITY[finding.severity]} />
            <span>
              <Code>{finding.kind}</Code> {finding.message}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
