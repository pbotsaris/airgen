/**
 * Schema drift detection: compares the live base against the `airgenMeta`
 * baked into a previously generated file, matching everything **by ID** (the
 * same invariant the runtime hooks rely on). Pure and SDK-free like the
 * generator, so it runs in the extension iframe and in Node tests alike.
 *
 * Classification mirrors what actually breaks at runtime:
 *   - breaking: table/field deleted, or field type changed — `useRecords`
 *     silently yields []/undefined or a value the generated type lies about.
 *   - warning: select choice removed — code matching on that choice is dead.
 *   - info: rename (id kept) — harmless at runtime, but the generated file is
 *     stale relative to the live schema.
 *
 * Additions in the base that the meta doesn't know about are NOT drift.
 *
 * Everything this reads (table.name, field.name, field.type, options.choices)
 * is captured by `canonicalSchemaSnapshot` in schema-signature.ts, so any
 * drift-relevant change also produces a signature delta and the dev loop
 * regenerates. If a new drift check reads more of the schema, extend the
 * signature to match (see the coupling invariant in CLAUDE.md).
 */

import type {BaseLike, FieldLike, TableLike} from './generator.js';

/** Structural mirror of `AirgenFieldMeta` — what a generated file bakes in. */
export interface DriftFieldMetaLike {
  readonly id: string;
  /** Raw Airtable field name. Optional: older generated files lack it. */
  readonly name?: string;
  readonly type: string;
  readonly choices?: {readonly [choiceName: string]: string};
}

export interface DriftTableMetaLike {
  readonly id: string;
  readonly name: string;
  readonly fields: {readonly [fieldKey: string]: DriftFieldMetaLike};
}

export interface DriftMetaLike {
  readonly baseId?: string;
  readonly tables: {readonly [tableKey: string]: DriftTableMetaLike};
}

export type DriftSeverity = 'breaking' | 'warning' | 'info';

export type DriftKind =
  | 'table-missing'
  | 'field-missing'
  | 'field-type-changed'
  | 'choice-removed'
  | 'table-renamed'
  | 'field-renamed';

export interface DriftFinding {
  severity: DriftSeverity;
  kind: DriftKind;
  /** Sanitized key in meta.tables (the TableKey consumers use). */
  tableKey: string;
  /** Display name recorded in the meta. */
  tableName: string;
  fieldKey?: string;
  fieldName?: string;
  /** Value the meta recorded (old name, old type, removed choice name). */
  expected?: string;
  /** Live value, when one exists. */
  actual?: string;
  /** Ready-to-render, e.g. `field "Days Left" changed type: formula → number`. */
  message: string;
}

export interface DriftReport {
  ok: boolean;
  /** Sorted breaking first, then warning, then info. */
  findings: DriftFinding[];
  counts: {breaking: number; warning: number; info: number};
}

const SEVERITY_ORDER: {[S in DriftSeverity]: number} = {breaking: 0, warning: 1, info: 2};

function liveChoiceIds(field: FieldLike): Set<string> | null {
  const choices = field.options?.choices;
  if (!Array.isArray(choices)) return null;
  const ids = new Set<string>();
  for (const choice of choices as Array<{id?: unknown}>) {
    if (typeof choice?.id === 'string') ids.add(choice.id);
  }
  return ids;
}

export function checkSchemaDrift(base: BaseLike, meta: DriftMetaLike): DriftReport {
  const findings: DriftFinding[] = [];
  const liveTables = new Map<string, TableLike>();
  for (const table of base.tables) liveTables.set(table.id, table);

  for (const [tableKey, tableMeta] of Object.entries(meta.tables ?? {})) {
    const tableName = tableMeta.name;
    const liveTable = liveTables.get(tableMeta.id);

    if (!liveTable) {
      findings.push({
        severity: 'breaking',
        kind: 'table-missing',
        tableKey,
        tableName,
        expected: tableName,
        message: `table ${JSON.stringify(tableName)} no longer exists — useRecords('${tableKey}') returns [] (unless another table has the same name)`,
      });
      continue;
    }

    if (liveTable.name !== tableName) {
      findings.push({
        severity: 'info',
        kind: 'table-renamed',
        tableKey,
        tableName,
        expected: tableName,
        actual: liveTable.name,
        message: `table renamed: ${JSON.stringify(tableName)} → ${JSON.stringify(liveTable.name)} (regenerate to refresh types)`,
      });
    }

    const liveFields = new Map<string, FieldLike>();
    for (const field of liveTable.fields) liveFields.set(field.id, field);

    for (const [fieldKey, fieldMeta] of Object.entries(tableMeta.fields ?? {})) {
      const fieldName = fieldMeta.name ?? fieldKey;
      const liveField = liveFields.get(fieldMeta.id);

      if (!liveField) {
        findings.push({
          severity: 'breaking',
          kind: 'field-missing',
          tableKey,
          tableName,
          fieldKey,
          fieldName,
          expected: fieldName,
          message: `field ${JSON.stringify(fieldName)} (${tableName}) no longer exists — reads as undefined`,
        });
        continue;
      }

      if (liveField.type !== fieldMeta.type) {
        findings.push({
          severity: 'breaking',
          kind: 'field-type-changed',
          tableKey,
          tableName,
          fieldKey,
          fieldName,
          expected: fieldMeta.type,
          actual: liveField.type,
          message: `field ${JSON.stringify(fieldName)} (${tableName}) changed type: ${fieldMeta.type} → ${liveField.type}`,
        });
        continue;
      }

      if (fieldMeta.name !== undefined && liveField.name !== fieldMeta.name) {
        findings.push({
          severity: 'info',
          kind: 'field-renamed',
          tableKey,
          tableName,
          fieldKey,
          fieldName,
          expected: fieldMeta.name,
          actual: liveField.name,
          message: `field renamed: ${JSON.stringify(fieldMeta.name)} → ${JSON.stringify(liveField.name)} (${tableName})`,
        });
      }

      if (fieldMeta.choices) {
        const liveIds = liveChoiceIds(liveField);
        if (liveIds) {
          for (const [choiceName, choiceId] of Object.entries(fieldMeta.choices)) {
            if (liveIds.has(choiceId)) continue;
            findings.push({
              severity: 'warning',
              kind: 'choice-removed',
              tableKey,
              tableName,
              fieldKey,
              fieldName,
              expected: choiceName,
              message: `choice ${JSON.stringify(choiceName)} removed from ${JSON.stringify(fieldName)} (${tableName})`,
            });
          }
        }
      }
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = {breaking: 0, warning: 0, info: 0};
  for (const finding of findings) counts[finding.severity]++;

  return {ok: findings.length === 0, findings, counts};
}
