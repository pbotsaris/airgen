import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAirgenMeta} from '../dist/client/generator.js';
import {makeCreateTypedHooks} from '../dist/client/useTypedRecords.js';
import {nullSafeUseRecords} from '../dist/client/sdk.js';
import {mockBase} from './fixtures/mock-base.js';
import {fakeAdapter, fakeBase, fakeRecord, fakeTable, writes} from './fixtures/fake-sdk.js';

const meta = buildAirgenMeta(mockBase);
const projects = mockBase.tables[0];

/** Projects as it would look in a duplicated base: same names and types, new ids. */
function lookAlike(transform = field => field) {
  const copy = structuredClone(projects);
  copy.id = 'tblCopy0000000001';
  copy.fields = copy.fields.map((field, index) =>
    transform({...field, id: `fldCopy${String(index).padStart(10, '0')}`}),
  );
  copy.primaryField = {id: copy.fields[0].id};
  return fakeTable(copy);
}

function hooksFor(tables, adapterOptions, hooksOptions) {
  const base = fakeBase(tables);
  const adapter = fakeAdapter(base, adapterOptions);
  return {base, adapter, hooks: makeCreateTypedHooks(adapter)(meta, hooksOptions)};
}

test('createTypedHooks runs on a plain-function adapter: no React, no jsdom', () => {
  const table = fakeTable(projects);
  const {hooks} = hooksFor([table], {
    records: {[projects.id]: [fakeRecord('rec1', {fldName0000000001: 'Site', fldBudget00000001: 10})]},
  });

  assert.deepEqual(Object.keys(hooks).sort(), [
    'useFields',
    'useMutations',
    'useQuery',
    'useRecords',
    'useSchemaDrift',
    'useTable',
  ]);
  assert.equal(hooks.useTable('Projects'), table);
  const [row] = hooks.useRecords('Projects');
  assert.deepEqual(row.fields, {name: 'Site', budget: 10});
});

test('useMutations writes through the resolved table, by field id', async () => {
  const table = fakeTable(projects);
  const {hooks} = hooksFor([table]);

  const result = await hooks.useMutations('Projects').update('rec1', 'status', {name: 'Done'});
  assert.deepEqual(result, {ok: true, ids: ['rec1'], issues: []});
  assert.deepEqual(writes(table), [['update', [{id: 'rec1', fields: {fldStatus00000001: {id: 'selDone000000001'}}}]]]);
});

test('useMutations is memoized on the resolved table, with deps that stay equal across renders', () => {
  const {hooks, adapter} = hooksFor([fakeTable(projects)]);
  hooks.useMutations('Projects');
  hooks.useMutations('Projects');

  assert.equal(adapter.memoCalls.length, 2);
  const [first, second] = adapter.memoCalls;
  assert.equal(first.length, second.length);
  first.forEach((dep, index) => assert.equal(dep, second[index], `dep ${index} changed between renders`));
});

test('a table hidden from this extension: reads are empty, writes refused, nothing throws', async () => {
  const {hooks} = hooksFor([]); // Projects not visible

  assert.equal(hooks.useTable('Projects'), null);
  assert.deepEqual(hooks.useRecords('Projects'), []);
  assert.deepEqual(hooks.useQuery('Projects', {where: [{field: 'done', op: 'notEmpty'}]}), []);

  const fields = hooks.useFields('Projects');
  assert.equal(fields.status.field, null);
  assert.equal(fields.status.isWritable, false);
  assert.equal(fields.status.validation.issues[0].kind, 'field-missing');
  // Choices still come from the generated meta.
  assert.ok(fields.status.choices.some(choice => choice.name === 'Done'));

  const mutations = hooks.useMutations('Projects');
  const result = await mutations.create({name: 'x'});
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].kind, 'table-missing');
  assert.equal(mutations.can.create().hasPermission, false);
});

test('an unknown table key (plain-JS caller) resolves to nothing instead of throwing', async () => {
  const {hooks} = hooksFor([fakeTable(projects)]);
  assert.equal(hooks.useTable('Nope'), null);
  assert.deepEqual(hooks.useRecords('Nope'), []);
  assert.deepEqual(hooks.useFields('Nope'), {});
  assert.equal((await hooks.useMutations('Nope').remove('rec1')).ok, false);
});

test('useFields: one live inspector per generated field key', () => {
  const {hooks} = hooksFor([fakeTable(projects)]);
  const fields = hooks.useFields('Projects');

  assert.deepEqual(Object.keys(fields), Object.keys(meta.tables.Projects.fields));
  assert.equal(fields.status.field.id, 'fldStatus00000001');
  assert.equal(fields.status.isWritable, true);
  assert.equal(fields.daysLeft.isWritable, false); // formula
  assert.deepEqual(fields.status.convertTo('done'), {id: 'selDone000000001'});
});

test('useQuery filters and searches useRecords rows', () => {
  const {hooks} = hooksFor([fakeTable(projects)], {
    records: {
      [projects.id]: [
        fakeRecord('rec1', {
          fldName0000000001: 'Site redesign',
          fldStatus00000001: {id: 'selDone000000001', name: 'Done'},
        }),
        fakeRecord('rec2', {
          fldName0000000001: 'Site launch',
          fldStatus00000001: {id: 'selTodo000000001', name: 'Todo'},
        }),
        fakeRecord('rec3', {fldName0000000001: 'Café', fldStatus00000001: {id: 'selDone000000001', name: 'Done'}}),
      ],
    },
  });

  const done = hooks.useQuery('Projects', {where: [{field: 'status', op: 'is', value: 'Done'}]});
  assert.deepEqual(
    done.map(row => row.id),
    ['rec1', 'rec3'],
  );

  const searched = hooks.useQuery('Projects', {search: {query: 'cafe', fields: ['name']}});
  assert.deepEqual(
    searched.map(row => row.id),
    ['rec3'],
  );
  assert.equal(hooks.useQuery('Projects').length, 3);
});

// --- Custom properties (interface flavor) -----------------------------------

const config = {customProperties: {Projects: 'Projects table'}};
const propertyKey = `airgenTable_${projects.id}`;

test('custom properties: one table picker per configured key, defaulting to the generated table', () => {
  const generated = fakeTable(projects);
  let definitions;
  const {hooks, adapter} = hooksFor(
    [generated],
    {
      customProperties: defs => {
        definitions = defs;
        return {[propertyKey]: defs[0].defaultValue};
      },
    },
    config,
  );

  hooks.useRecords('Projects');
  hooks.useMutations('Projects');
  assert.deepEqual(
    definitions.map(({key, label, type}) => ({key, label, type})),
    [{key: propertyKey, label: 'Projects table', type: 'table'}],
  );
  assert.equal(definitions[0].defaultValue, generated);
  // The SDK requires a stable getCustomProperties identity.
  assert.equal(adapter.customPropertyCalls[0], adapter.customPropertyCalls[1]);
  // Unconfigured tables don't touch custom properties.
  hooks.useRecords('MyTable');
  assert.equal(adapter.customPropertyCalls.length, 2);
});

test('custom properties: the generated table picked passes through untouched', async () => {
  const generated = fakeTable(projects);
  const {hooks} = hooksFor([generated], {customProperties: () => ({[propertyKey]: generated})}, config);

  const result = await hooks.useMutations('Projects').update('rec1', 'budget', 5);
  assert.deepEqual(result, {ok: true, ids: ['rec1'], issues: []});
  assert.deepEqual(writes(generated), [['update', [{id: 'rec1', fields: {fldBudget00000001: 5}}]]]);
});

test('custom properties: a look-alike table is matched by field name and read and written by its own ids', async () => {
  const copy = lookAlike();
  const budgetId = copy.fields.find(field => field.name === 'Budget').id;
  const {hooks} = hooksFor(
    [fakeTable(projects), copy],
    {
      customProperties: () => ({[propertyKey]: copy}),
      records: {[copy.id]: [fakeRecord('recCopy1', {[budgetId]: 99})]},
    },
    config,
  );

  assert.equal(hooks.useTable('Projects'), copy);
  assert.deepEqual(hooks.useRecords('Projects')[0].fields, {budget: 99});
  assert.equal(hooks.useFields('Projects').budget.field.id, budgetId);

  const mutations = hooks.useMutations('Projects');
  assert.equal(mutations.validation.valid(), true);
  const result = await mutations.update('recCopy1', 'budget', 5);
  assert.equal(result.ok, true);
  assert.deepEqual(writes(copy), [['update', [{id: 'recCopy1', fields: {[budgetId]: 5}}]]]);
});

test('custom properties: an incompatible pick blocks every write but still renders', async () => {
  // Budget is text on the picked table.
  const copy = lookAlike(field => (field.name === 'Budget' ? {...field, type: 'singleLineText'} : field));
  const nameId = copy.fields[0].id;
  const budgetId = copy.fields.find(field => field.name === 'Budget').id;
  const {hooks} = hooksFor(
    [copy],
    {
      customProperties: () => ({[propertyKey]: copy}),
      records: {[copy.id]: [fakeRecord('recCopy1', {[nameId]: 'Site', [budgetId]: 'not a number'})]},
    },
    config,
  );

  // Rendering continues; the mismatched field reads as absent, never as a wrong shape.
  assert.deepEqual(hooks.useRecords('Projects')[0].fields, {name: 'Site'});

  const mutations = hooks.useMutations('Projects');
  assert.equal(mutations.validation.valid(), false);
  assert.deepEqual(
    mutations.validation.errors.map(issue => [issue.kind, issue.fieldKey]),
    [['field-incompatible', 'budget']],
  );
  // Even a write that doesn't touch the bad field is refused.
  const result = await mutations.update('recCopy1', 'name', 'Renamed');
  assert.equal(result.ok, false);
  assert.equal(result.failedBatch, null);
  assert.ok(result.issues.some(issue => issue.kind === 'field-incompatible'));
  assert.deepEqual(copy.calls, []);
  assert.equal(mutations.can.update().hasPermission, false);
});

test('custom properties: a pick missing some fields warns, and only those fields are refused', async () => {
  const copy = lookAlike(field => (field.name === 'Notes!' ? {...field, name: 'Remarks'} : field));
  const {hooks} = hooksFor([copy], {customProperties: () => ({[propertyKey]: copy})}, config);
  const mutations = hooks.useMutations('Projects');

  assert.deepEqual(
    mutations.validation.warnings.map(issue => [issue.kind, issue.fieldKey]),
    [['field-unresolved', 'notes']],
  );
  assert.equal((await mutations.update('rec1', 'budget', 1)).ok, true);
  const refused = await mutations.update('rec1', 'notes', 'x');
  assert.equal(refused.ok, false);
  assert.ok(refused.issues.some(issue => issue.kind === 'field-missing' && issue.fieldKey === 'notes'));
});

test('custom properties: the primary field matches even when renamed', async () => {
  const copy = lookAlike(field => (field.name === 'Name' ? {...field, name: 'Title'} : field));
  const {hooks} = hooksFor([copy], {customProperties: () => ({[propertyKey]: copy})}, config);
  const mutations = hooks.useMutations('Projects');

  assert.equal(mutations.validation.issues.length, 0);
  await mutations.update('rec1', 'name', 'x');
  assert.deepEqual(writes(copy)[0][1], [{id: 'rec1', fields: {[copy.fields[0].id]: 'x'}}]);
});

test('custom properties with nothing picked and no default: table-missing, nothing throws', async () => {
  const {hooks} = hooksFor([], {customProperties: () => ({[propertyKey]: null})}, config);
  assert.deepEqual(hooks.useRecords('Projects'), []);
  const result = await hooks.useMutations('Projects').create();
  assert.equal(result.issues[0].kind, 'table-missing');
});

test('custom properties on a flavor without them: generated table, with a warning', async () => {
  const generated = fakeTable(projects);
  const {hooks} = hooksFor([generated], {}, config); // no useCustomProperties on the adapter

  const mutations = hooks.useMutations('Projects');
  assert.deepEqual(
    mutations.validation.issues.map(issue => [issue.kind, issue.level]),
    [['custom-properties-unsupported', 'warning']],
  );
  const result = await mutations.update('rec1', 'done', true);
  assert.equal(result.ok, true);
  assert.equal(result.issues[0].kind, 'custom-properties-unsupported');
  assert.equal(writes(generated).length, 1);
});

// --- Adapter contract: useRecords(null) --------------------------------------

test('nullSafeUseRecords: a missing table reads as null without reaching an SDK hook that throws on null', () => {
  const calls = [];
  const sdkUseRecords = table => {
    calls.push(table.id); // the interface SDK reads `table.id` unguarded
    return [`records of ${table.id}`];
  };
  const base = fakeBase([projects, mockBase.tables[1]]);
  const useRecords = nullSafeUseRecords(() => base, sdkUseRecords);

  assert.deepEqual(useRecords(base.tables[1]), ['records of tblMyTable00000001']);
  // Null: the SDK hook still runs (same hook count), on a stand-in, and the result is hidden.
  assert.equal(useRecords(null), null);
  assert.deepEqual(calls, ['tblMyTable00000001', projects.id]);

  // A base with no visible table has nothing to stand in; nothing throws.
  const empty = nullSafeUseRecords(() => fakeBase([]), sdkUseRecords);
  assert.equal(empty(null), null);
  assert.equal(calls.length, 2);
});
