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

import {buildFieldTypeMeta} from './generator.js';
import type {BaseLike, ChoiceMeta, FieldLike, FieldTypeMeta, TableLike} from './generator.js';

/**
 * Choices as a generated file records them. Current files use the array form;
 * files generated before that shape change use a name → id map, which
 * `normalizeChoices` folds into the same list.
 */
export type DriftChoicesLike =
  | ReadonlyArray<{readonly id: string; readonly name: string}>
  | {readonly [choiceName: string]: string};

export interface DriftResultMetaLike {
  readonly type: string;
  readonly choices?: DriftChoicesLike;
  readonly result?: DriftResultMetaLike;
}

/** Structural mirror of `AirgenFieldMeta` — what a generated file bakes in. */
export interface DriftFieldMetaLike {
  readonly id: string;
  /** Raw Airtable field name. Optional: older generated files lack it. */
  readonly name?: string;
  readonly type: string;
  readonly choices?: DriftChoicesLike;
  /** Computed-field result projection. Optional: older generated files lack it. */
  readonly result?: DriftResultMetaLike;
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
  | 'result-type-changed'
  | 'choice-removed'
  | 'choice-renamed'
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

/** Folds either recorded choice shape into a plain list. */
function normalizeChoices(choices: DriftChoicesLike | undefined): ChoiceMeta[] | null {
  if (!choices) return null;
  if (Array.isArray(choices)) {
    const list = choices as ReadonlyArray<{id?: unknown; name?: unknown}>;
    return list
      .filter(choice => typeof choice?.id === 'string' && typeof choice?.name === 'string')
      .map(choice => ({id: choice.id as string, name: choice.name as string}));
  }
  return Object.entries(choices as {[choiceName: string]: string})
    .filter(([, id]) => typeof id === 'string')
    .map(([name, id]) => ({id, name}));
}

interface ShapeContext {
  tableKey: string;
  tableName: string;
  fieldKey: string;
  fieldName: string;
  /** '' at the field itself, then 'result', 'result.result', … */
  path: string;
}

function via(path: string): string {
  return path === '' ? '' : ` (via ${path})`;
}

/**
 * Compares the type-relevant projection recorded in the meta against the same
 * projection of the live field, descending through `result` — a lookup of a
 * select carries that select's choices, so drift can hide one level down.
 */
function compareTypeShape(
  metaShape: {choices?: DriftChoicesLike; result?: DriftResultMetaLike},
  liveShape: FieldTypeMeta,
  context: ShapeContext,
  findings: DriftFinding[],
): void {
  const {tableKey, tableName, fieldKey, fieldName, path} = context;
  const metaChoices = normalizeChoices(metaShape.choices);

  if (metaChoices) {
    const liveNamesById = new Map<string, string>();
    for (const choice of liveShape.choices ?? []) liveNamesById.set(choice.id, choice.name);

    for (const choice of metaChoices) {
      const liveName = liveNamesById.get(choice.id);
      if (liveName === undefined) {
        findings.push({
          severity: 'warning',
          kind: 'choice-removed',
          tableKey,
          tableName,
          fieldKey,
          fieldName,
          expected: choice.name,
          message: `choice ${JSON.stringify(choice.name)} removed from ${JSON.stringify(fieldName)} (${tableName})${via(path)}`,
        });
      } else if (liveName !== choice.name) {
        findings.push({
          severity: 'warning',
          kind: 'choice-renamed',
          tableKey,
          tableName,
          fieldKey,
          fieldName,
          expected: choice.name,
          actual: liveName,
          message: `choice renamed: ${JSON.stringify(choice.name)} → ${JSON.stringify(liveName)} in ${JSON.stringify(fieldName)} (${tableName})${via(path)} — code comparing the old name is now dead`,
        });
      }
    }
  }

  // Files generated before `result` was recorded have none; skip rather than
  // reporting every computed field as changed.
  if (!metaShape.result) return;

  const resultPath = path === '' ? 'result' : `${path}.result`;
  const liveResult = liveShape.result;
  const liveResultType = liveResult?.type ?? 'unknown';

  if (liveResult === undefined || liveResult.type !== metaShape.result.type) {
    findings.push({
      severity: 'breaking',
      kind: 'result-type-changed',
      tableKey,
      tableName,
      fieldKey,
      fieldName,
      expected: metaShape.result.type,
      actual: liveResultType,
      message: `field ${JSON.stringify(fieldName)} (${tableName}) changed computed type at ${resultPath}: ${metaShape.result.type} → ${liveResultType}`,
    });
    return;
  }

  compareTypeShape(metaShape.result, liveResult, {...context, path: resultPath}, findings);
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

      compareTypeShape(
        fieldMeta,
        buildFieldTypeMeta(liveField.type, liveField.options ?? null),
        {tableKey, tableName, fieldKey, fieldName, path: ''},
        findings,
      );
    }
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = {breaking: 0, warning: 0, info: 0};
  for (const finding of findings) counts[finding.severity]++;

  return {ok: findings.length === 0, findings, counts};
}
