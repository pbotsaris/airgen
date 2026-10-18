/**
 * Schema drift in a released extension.
 *
 * Renames never break anything (every lookup is by ID), but a deleted table
 * or field silently reads as empty, and a type change makes the generated
 * types lie. `useSchemaDrift()` compares the live schema with the
 * `airgenMeta` baked into the generated file, re-running only on schema
 * mutations and without any daemon involved, so it is safe in production.
 *
 * Findings are `breaking` (deleted table or field, type change, a writable
 * field that became computed), `warning` (a removed select choice), or `info`
 * (a rename: harmless, but the generated file is stale). Additions on the
 * base side are never drift.
 */
import React from 'react';
import {useSchemaDrift} from './airtable-schema';

export function DriftBanner() {
  const drift = useSchemaDrift();
  if (drift.ok) return null;

  return (
    <div role="alert">
      {drift.counts.breaking > 0 ? (
        <strong>This extension is out of date with the base.</strong>
      ) : (
        <strong>The base has changed since this extension was built.</strong>
      )}
      <ul>
        {drift.findings.map(finding => (
          // Sorted breaking first; each finding has tableKey/fieldKey, expected/actual, and a ready-to-render message.
          <li key={`${finding.kind}:${finding.tableKey}:${finding.fieldKey ?? ''}`}>
            [{finding.severity}] {finding.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
