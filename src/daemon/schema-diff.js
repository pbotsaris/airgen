/**
 * Diffs one generated file against the next, by ID.
 *
 * This is the codemod's input, and it is deliberately *not* `checkSchemaDrift`:
 * drift compares the live base to a meta and speaks in Airtable names, while
 * this compares two generated files and speaks in **sanitized keys** — the
 * identifiers actually written in consumer code (`contactEmail`, `Projects`,
 * `ProjectsRecord`). Matching by id is what makes a rename an exact fact
 * rather than a guess.
 *
 * Changes split in two: `fixable` ones have a known old → new symbol and can be
 * rewritten mechanically; the rest changed a value's shape or removed it, so
 * they only get their usages located and listed.
 */

/** Choice alias declarations carry their table/field in the doc comment above them. */
const ALIAS_RE =
  /\/\*\* choices of ("(?:[^"\\]|\\.)*") in table ("(?:[^"\\]|\\.)*") \*\/\s*export type (\w+) =/g;

const META_MARKER = 'export const airgenMeta = ';

/** Scans to the `}` matching the `{` at `start`, skipping over JSON strings. */
function matchingBrace(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Pulls the `airgenMeta` object literal out of a generated file. The generator
 * emits it as `JSON.stringify(meta, null, 2)`, so the slice is always parseable
 * JSON — anything else means this isn't an airgen file, and we return null.
 * @returns {object | null}
 */
export function extractAirgenMeta(source) {
  if (typeof source !== 'string') return null;

  const marker = source.indexOf(META_MARKER);
  if (marker === -1) return null;

  const open = source.indexOf('{', marker + META_MARKER.length);
  if (open === -1) return null;

  const close = matchingBrace(source, open);
  if (close === -1) return null;

  try {
    const meta = JSON.parse(source.slice(open, close + 1));
    return meta && typeof meta === 'object' && meta.tables ? meta : null;
  } catch {
    return null;
  }
}

/**
 * Maps `aliasKey(tableName, fieldName)` → choice alias type name, read back out
 * of the source. The alias name is derived from Airtable names through the generator's
 * PascalCase + collision rules; reading it beats reimplementing them here.
 * @returns {Map<string, string>}
 */
export function extractChoiceAliases(source) {
  const aliases = new Map();
  if (typeof source !== 'string') return aliases;

  for (const match of source.matchAll(ALIAS_RE)) {
    try {
      aliases.set(aliasKey(JSON.parse(match[2]), JSON.parse(match[1])), match[3]);
    } catch {
      // A doc comment we can't parse just means no alias rename is offered.
    }
  }
  return aliases;
}

/** Unambiguous, printable composite key — Airtable names may contain any character. */
export function aliasKey(tableName, fieldName) {
  return JSON.stringify([tableName, fieldName]);
}

/**
 * Folds either recorded choice shape into `[{id, name}]`. Mirrors
 * `normalizeChoices` in src/client/schema-drift.ts — the two build halves can't
 * share a module, so keep them in step.
 */
function normalizeChoices(choices) {
  if (!choices) return null;
  if (Array.isArray(choices)) {
    return choices.filter(choice => typeof choice?.id === 'string' && typeof choice?.name === 'string');
  }
  if (typeof choices !== 'object') return null;
  return Object.entries(choices)
    .filter(([, id]) => typeof id === 'string')
    .map(([name, id]) => ({id, name}));
}

/** id → {key, value} for the sanitized-key maps the meta stores. */
function byId(record) {
  const index = new Map();
  for (const [key, value] of Object.entries(record ?? {})) {
    if (value && typeof value.id === 'string') index.set(value.id, {key, value});
  }
  return index;
}

function label(fieldName, tableName) {
  return `${JSON.stringify(fieldName)} (${tableName})`;
}

/**
 * Compares the type projections of one field across the two files, descending
 * through `result` — a lookup of a select carries that select's choices.
 */
function compareShapes(oldShape, newShape, context, path, changes) {
  const {tableKey, oldTableKey, fieldKey, oldFieldKey, fieldName, tableName, choiceAlias} = context;
  const suffix = path === '' ? '' : ` (via ${path})`;
  const oldChoices = normalizeChoices(oldShape.choices);

  if (oldChoices) {
    const newNamesById = new Map();
    for (const choice of normalizeChoices(newShape.choices) ?? []) newNamesById.set(choice.id, choice.name);

    for (const choice of oldChoices) {
      const newName = newNamesById.get(choice.id);
      if (newName === undefined) {
        changes.push({
          kind: 'choice-removed',
          fixable: false,
          severity: 'warning',
          tableKey,
          oldTableKey,
          fieldKey,
          oldFieldKey,
          choiceAlias,
          from: choice.name,
          description: `choice ${JSON.stringify(choice.name)} removed from ${label(fieldName, tableName)}${suffix}`,
        });
      } else if (newName !== choice.name) {
        changes.push({
          kind: 'choice-name-renamed',
          fixable: true,
          severity: 'info',
          tableKey,
          oldTableKey,
          fieldKey,
          oldFieldKey,
          choiceAlias,
          from: choice.name,
          to: newName,
          description: `choice renamed in ${label(fieldName, tableName)}${suffix}: ${JSON.stringify(choice.name)} → ${JSON.stringify(newName)}`,
        });
      }
    }
  }

  // Files generated before `result` was recorded have none — skip rather than
  // reporting every computed field as changed.
  if (!oldShape.result) return;

  const resultPath = path === '' ? 'result' : `${path}.result`;
  const newResultType = newShape.result?.type ?? 'unknown';

  if (newResultType !== oldShape.result.type) {
    changes.push({
      kind: 'result-type-changed',
      fixable: false,
      severity: 'breaking',
      tableKey,
      oldTableKey,
      fieldKey,
      oldFieldKey,
      from: oldShape.result.type,
      to: newResultType,
      description: `${label(fieldName, tableName)} changed computed type at ${resultPath}: ${oldShape.result.type} → ${newResultType}`,
    });
    return;
  }

  compareShapes(oldShape.result, newShape.result, context, resultPath, changes);
}

function diffFields(oldTable, newTable, oldTableKey, tableKey, oldAliases, newAliases, changes) {
  const newFields = byId(newTable.fields);

  for (const [fieldId, {key: oldFieldKey, value: oldField}] of byId(oldTable.fields)) {
    const match = newFields.get(fieldId);
    const fieldName = oldField.name ?? oldFieldKey;

    if (!match) {
      changes.push({
        kind: 'field-removed',
        fixable: false,
        severity: 'breaking',
        tableKey,
        oldTableKey,
        fieldKey: oldFieldKey,
        oldFieldKey,
        recordInterface: `${oldTableKey}Record`,
        from: oldFieldKey,
        description: `field ${label(fieldName, oldTable.name)} was deleted — it now reads as undefined`,
      });
      continue;
    }

    const {key: fieldKey, value: newField} = match;

    if (fieldKey !== oldFieldKey) {
      changes.push({
        kind: 'field-key-renamed',
        fixable: true,
        severity: 'info',
        tableKey,
        oldTableKey,
        fieldKey,
        oldFieldKey,
        recordInterface: `${oldTableKey}Record`,
        from: oldFieldKey,
        to: fieldKey,
        description: `field renamed: record.fields.${oldFieldKey} → record.fields.${fieldKey} (${newTable.name})`,
      });
    }

    if (oldField.type !== newField.type) {
      changes.push({
        kind: 'field-type-changed',
        fixable: false,
        severity: 'breaking',
        tableKey,
        oldTableKey,
        fieldKey,
        oldFieldKey,
        recordInterface: `${oldTableKey}Record`,
        from: oldField.type,
        to: newField.type,
        description: `field ${label(fieldName, newTable.name)} changed type: ${oldField.type} → ${newField.type} — its value shape is different now`,
      });
      continue; // the whole projection below it is moot
    }

    const oldAlias = oldAliases.get(aliasKey(oldTable.name, fieldName));
    const newAlias = newAliases.get(aliasKey(newTable.name, newField.name ?? fieldKey));

    if (oldAlias && newAlias && oldAlias !== newAlias) {
      changes.push({
        kind: 'type-name-renamed',
        fixable: true,
        severity: 'info',
        tableKey,
        oldTableKey,
        fieldKey,
        oldFieldKey,
        from: oldAlias,
        to: newAlias,
        description: `generated type renamed: ${oldAlias} → ${newAlias}`,
      });
    }

    compareShapes(
      oldField,
      newField,
      {tableKey, oldTableKey, fieldKey, oldFieldKey, fieldName, tableName: newTable.name, choiceAlias: oldAlias},
      '',
      changes,
    );
  }
}

/**
 * @returns {{ok: true, changes: object[]} | {ok: false, reason: string, changes: []}}
 */
export function diffGeneratedFiles(oldSource, newSource) {
  const oldMeta = extractAirgenMeta(oldSource);
  const newMeta = extractAirgenMeta(newSource);

  if (!oldMeta || !newMeta) {
    return {ok: false, reason: 'could not read airgenMeta from both files', changes: []};
  }

  const oldAliases = extractChoiceAliases(oldSource);
  const newAliases = extractChoiceAliases(newSource);
  const changes = [];
  const newTables = byId(newMeta.tables);

  for (const [tableId, {key: oldTableKey, value: oldTable}] of byId(oldMeta.tables)) {
    const match = newTables.get(tableId);

    if (!match) {
      changes.push({
        kind: 'table-removed',
        fixable: false,
        severity: 'breaking',
        tableKey: oldTableKey,
        oldTableKey,
        recordInterface: `${oldTableKey}Record`,
        from: oldTableKey,
        description: `table ${JSON.stringify(oldTable.name)} was deleted — useRecords('${oldTableKey}') now returns []`,
      });
      continue;
    }

    const {key: tableKey, value: newTable} = match;

    if (tableKey !== oldTableKey) {
      changes.push({
        kind: 'table-key-renamed',
        fixable: true,
        severity: 'info',
        tableKey,
        oldTableKey,
        from: oldTableKey,
        to: tableKey,
        description: `table key renamed: useRecords('${oldTableKey}') → useRecords('${tableKey}')`,
      });
      changes.push({
        kind: 'type-name-renamed',
        fixable: true,
        severity: 'info',
        tableKey,
        oldTableKey,
        from: `${oldTableKey}Record`,
        to: `${tableKey}Record`,
        description: `generated type renamed: ${oldTableKey}Record → ${tableKey}Record`,
      });
    }

    diffFields(oldTable, newTable, oldTableKey, tableKey, oldAliases, newAliases, changes);
  }

  return {ok: true, changes};
}
