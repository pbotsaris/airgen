/**
 * Pure diff of one generated file against the next. No TypeScript, no daemon —
 * this is the vocabulary the codemod acts on, so it gets fast, direct tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aliasKey,
  diffGeneratedFiles,
  extractAirgenMeta,
  extractChoiceAliases,
} from '../src/daemon/schema-diff.js';
import {generateTypeScriptFromBase} from '../dist/client/generator.js';
import {mockBase} from './fixtures/mock-base.js';

const source = generateTypeScriptFromBase(mockBase);

/** Regenerates the file after applying `mutate` to a clone of the fixture base. */
function regenerate(mutate) {
  const base = structuredClone(mockBase);
  mutate(base);
  return generateTypeScriptFromBase(base);
}

function projectsField(base, fieldId) {
  return base.tables[0].fields.find(field => field.id === fieldId);
}

function diff(mutate) {
  const result = diffGeneratedFiles(source, regenerate(mutate));
  assert.equal(result.ok, true, result.reason);
  return result.changes;
}

function only(changes, kind) {
  return changes.filter(change => change.kind === kind);
}

test('extractAirgenMeta reads the embedded meta back out of a generated file', () => {
  const meta = extractAirgenMeta(source);
  assert.equal(meta.baseId, 'appMockBase000001');
  assert.equal(meta.tables.Projects.id, 'tblProjects000001');
  assert.equal(meta.tables.Projects.fields.contactEmail.name, 'Contact Email');
  // The scan must not stop at the first `}` inside a nested object or a string.
  assert.equal(meta.tables.Projects.fields.status.choices.length, 3);
  assert.equal(meta.tables.Projects.fields.status.choices[1].name, 'In "Progress"');
});

test('extractAirgenMeta returns null for anything that is not a generated file', () => {
  assert.equal(extractAirgenMeta('const x = 1;'), null);
  assert.equal(extractAirgenMeta('export const airgenMeta = {oops'), null);
  assert.equal(extractAirgenMeta('export const airgenMeta = {"a": 1} as const;'), null); // no tables
  assert.equal(extractAirgenMeta(undefined), null);
});

test('extractChoiceAliases maps table+field names to the generated alias', () => {
  const aliases = extractChoiceAliases(source);
  assert.equal(aliases.get(aliasKey('Projects', 'Status')), 'ProjectsStatusChoice');
  assert.equal(aliases.get(aliasKey('Projects', 'Tags')), 'ProjectsTagsChoice');
  // Two tables both have a "Status" select — the aliases must not collide.
  assert.equal(aliases.get(aliasKey('2024 Plans', 'Status')), 'T2024PlansStatusChoice');
});

test('an unchanged schema produces no changes', () => {
  const result = diffGeneratedFiles(source, source);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, []);
});

test('unreadable input fails without throwing', () => {
  const result = diffGeneratedFiles('not a generated file', source);
  assert.equal(result.ok, false);
  assert.match(result.reason, /airgenMeta/);
  assert.deepEqual(result.changes, []);
});

test('a renamed field yields a fixable key rename in sanitized-key space', () => {
  const changes = diff(base => {
    projectsField(base, 'fldEmail000000001').name = 'Customer Email';
  });

  assert.equal(changes.length, 1);
  const [change] = changes;
  assert.equal(change.kind, 'field-key-renamed');
  assert.equal(change.fixable, true);
  assert.equal(change.from, 'contactEmail');
  assert.equal(change.to, 'customerEmail');
  assert.equal(change.recordInterface, 'ProjectsRecord');
  assert.equal(change.tableKey, 'Projects');
});

test('a field rename that survives sanitization unchanged is not a change', () => {
  // "Notes!" and "Notes" both camelCase to `notes`, so no code has to move.
  const changes = diff(base => {
    projectsField(base, 'fldNotes000000001').name = 'Notes';
  });
  assert.deepEqual(changes, []);
});

test('a renamed table yields both the key rename and the interface rename', () => {
  const changes = diff(base => {
    base.tables[0].name = 'Projekte';
  });

  const keyRename = only(changes, 'table-key-renamed');
  assert.equal(keyRename.length, 1);
  assert.deepEqual([keyRename[0].from, keyRename[0].to], ['Projects', 'Projekte']);

  const typeRenames = only(changes, 'type-name-renamed');
  assert.ok(typeRenames.some(c => c.from === 'ProjectsRecord' && c.to === 'ProjekteRecord'));
  // The select aliases are derived from the table name too.
  assert.ok(typeRenames.some(c => c.from === 'ProjectsStatusChoice' && c.to === 'ProjekteStatusChoice'));
  assert.ok(changes.every(change => change.fixable));
});

test('a renamed choice is fixable and carries the alias that gates the rewrite', () => {
  const changes = diff(base => {
    projectsField(base, 'fldStatus00000001').options.choices.find(
      choice => choice.id === 'selTodo000000001',
    ).name = 'Backlog';
  });

  assert.equal(changes.length, 1);
  const [change] = changes;
  assert.equal(change.kind, 'choice-name-renamed');
  assert.equal(change.fixable, true);
  assert.equal(change.from, 'Todo');
  assert.equal(change.to, 'Backlog');
  assert.equal(change.choiceAlias, 'ProjectsStatusChoice');
  assert.equal(change.fieldKey, 'status');
});

test('deletions and type changes are reported but never fixable', () => {
  const removedField = diff(base => {
    base.tables[0].fields = base.tables[0].fields.filter(f => f.id !== 'fldEmail000000001');
  });
  assert.equal(removedField.length, 1);
  assert.equal(removedField[0].kind, 'field-removed');
  assert.equal(removedField[0].fixable, false);
  assert.equal(removedField[0].severity, 'breaking');
  assert.equal(removedField[0].from, 'contactEmail');

  const removedTable = diff(base => {
    base.tables = base.tables.filter(table => table.id !== 'tblMyTable00000002');
  });
  assert.equal(removedTable.length, 1);
  assert.equal(removedTable[0].kind, 'table-removed');
  assert.equal(removedTable[0].from, 'MyTable2');

  const retyped = diff(base => {
    projectsField(base, 'fldName0000000001').type = 'number';
  });
  assert.equal(retyped.length, 1);
  assert.equal(retyped[0].kind, 'field-type-changed');
  assert.equal(retyped[0].fixable, false);
  assert.deepEqual([retyped[0].from, retyped[0].to], ['singleLineText', 'number']);

  const removedChoice = diff(base => {
    const status = projectsField(base, 'fldStatus00000001');
    status.options.choices = status.options.choices.filter(c => c.id !== 'selDone000000001');
  });
  assert.equal(removedChoice.length, 1);
  assert.equal(removedChoice[0].kind, 'choice-removed');
  assert.equal(removedChoice[0].fixable, false);
  assert.equal(removedChoice[0].from, 'Done');
});

test('a changed computed result type is breaking even with the field type intact', () => {
  const changes = diff(base => {
    projectsField(base, 'fldFormula0000001').options.result = {type: 'singleLineText'};
  });

  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'result-type-changed');
  assert.equal(changes[0].fixable, false);
  assert.deepEqual([changes[0].from, changes[0].to], ['number', 'singleLineText']);
  assert.equal(changes[0].fieldKey, 'daysLeft');
});

test('the diff descends into result: a looked-up choice rename is caught', () => {
  const withLookup = structuredClone(mockBase);
  withLookup.tables[0].fields.find(f => f.id === 'fldLookup00000001').options.result = {
    type: 'singleSelect',
    options: {choices: [{id: 'selLk0000000001', name: 'Alpha'}]},
  };
  const before = generateTypeScriptFromBase(withLookup);

  const after = structuredClone(withLookup);
  after.tables[0].fields.find(f => f.id === 'fldLookup00000001').options.result.options.choices[0].name = 'Omega';

  const {changes} = diffGeneratedFiles(before, generateTypeScriptFromBase(after));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'choice-name-renamed');
  assert.deepEqual([changes[0].from, changes[0].to], ['Alpha', 'Omega']);
  assert.match(changes[0].description, /via result/);
});

test('additions are never changes — nothing in existing code can break', () => {
  const changes = diff(base => {
    base.tables[0].fields.push({id: 'fldNew0000000001', name: 'Brand New', type: 'singleLineText'});
    projectsField(base, 'fldStatus00000001').options.choices.push({id: 'selNew0000000001', name: 'Blocked'});
    base.tables.push({
      id: 'tblNew00000000001',
      name: 'New Table',
      fields: [{id: 'fldNt100000000001', name: 'Name', type: 'singleLineText'}],
    });
  });
  assert.deepEqual(changes, []);
});

test('a rename and a deletion in one burst are reported independently', () => {
  const changes = diff(base => {
    projectsField(base, 'fldEmail000000001').name = 'Customer Email';
    base.tables[0].fields = base.tables[0].fields.filter(f => f.id !== 'fldPhone000000001');
  });

  assert.equal(changes.length, 2);
  assert.equal(only(changes, 'field-key-renamed')[0].to, 'customerEmail');
  assert.equal(only(changes, 'field-removed')[0].from, 'phone');
});

test('old metas with object-form choices still diff by id', () => {
  // Simulate a file generated before choices became a list.
  const legacy = source.replace(
    /"choices": \[[^\]]*\]/,
    '"choices": {"Todo": "selTodo000000001", "In \\"Progress\\"": "selProg000000001", "Done": "selDone000000001"}',
  );
  assert.notEqual(legacy, source);

  const next = regenerate(base => {
    projectsField(base, 'fldStatus00000001').options.choices.find(
      c => c.id === 'selTodo000000001',
    ).name = 'Backlog';
  });

  const {ok, changes} = diffGeneratedFiles(legacy, next);
  assert.equal(ok, true);
  const renames = only(changes, 'choice-name-renamed');
  assert.equal(renames.length, 1);
  assert.deepEqual([renames[0].from, renames[0].to], ['Todo', 'Backlog']);
});

test('upgrading to a color-carrying meta produces no changes and no codemod work', () => {
  // Simulate the first save after upgrading airgen: the old file's choices
  // have no colors (and no version), the new file's do. Choices diff by
  // id/name only, so the rewrite must be silent.
  const legacy = source
    .replace(/,\s*"color": "[^"]*"/g, '')
    .replace(/\s*"version": 1,/, '');
  assert.notEqual(legacy, source);
  assert.equal(extractAirgenMeta(legacy).tables.Projects.fields.status.choices[0].color, undefined);

  const {ok, changes} = diffGeneratedFiles(legacy, source);
  assert.equal(ok, true);
  assert.deepEqual(changes, []);
});
