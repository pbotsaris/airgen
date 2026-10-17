import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAirgenMeta} from '../dist/client/generator.js';
import {BATCH_SIZE, createMutations} from '../dist/client/runtime/mutations.js';
import {cloneValues} from '../dist/client/runtime/clone.js';
import {mockBase} from './fixtures/mock-base.js';
import {fakeRecord, fakeTable, writes} from './fixtures/fake-sdk.js';

const projects = mockBase.tables[0];
const meta = buildAirgenMeta(mockBase).tables.Projects;

function setup(behavior) {
  const table = fakeTable(projects, behavior);
  return {table, mutations: createMutations(table, meta)};
}

const ids = n => Array.from({length: n}, (_, i) => `rec${String(i).padStart(14, '0')}`);

test('update: field key → field id, read value → write shape, end to end', async () => {
  const {table, mutations} = setup();
  const result = await mutations.update('rec1', 'status', {id: 'selDone000000001', name: 'Done', color: 'greenBright'});

  assert.deepEqual(result, {ok: true, ids: ['rec1'], issues: []});
  assert.deepEqual(writes(table), [['update', [{id: 'rec1', fields: {fldStatus00000001: {id: 'selDone000000001'}}}]]]);
});

test('updateFields: null clears, undefined is omitted, records may be passed as objects', async () => {
  const {table, mutations} = setup();
  const result = await mutations.updateFields({id: 'rec1'}, {name: 'New', budget: null, notes: undefined});

  assert.equal(result.ok, true);
  assert.deepEqual(writes(table), [
    ['update', [{id: 'rec1', fields: {fldName0000000001: 'New', fldBudget00000001: null}}]],
  ]);
});

test('updateMany: per-record fields, entries with nothing to write are skipped', async () => {
  const {table, mutations} = setup();
  const result = await mutations.updateMany([
    {record: 'rec1', fields: {done: true}},
    {record: 'rec2', fields: {notes: undefined}},
    {record: 'rec3', fields: {tasks: ['recA', {id: 'recB', name: 'B'}]}},
  ]);

  assert.deepEqual(result.ids, ['rec1', 'rec3']);
  assert.deepEqual(writes(table)[0][1], [
    {id: 'rec1', fields: {fldDone0000000001: true}},
    {id: 'rec3', fields: {fldLinks000000001: [{id: 'recA'}, {id: 'recB'}]}},
  ]);
});

test('create and createMany return the new ids in order', async () => {
  const {table, mutations} = setup();

  const blank = await mutations.create();
  assert.equal(blank.ok, true);
  assert.equal(blank.ids.length, 1);
  assert.deepEqual(writes(table)[0], ['create', [{fields: {}}]]);

  const many = await mutations.createMany([{name: 'A'}, {name: 'B', tags: ['Dev']}]);
  assert.equal(many.ids.length, 2);
  assert.deepEqual(writes(table)[1][1], [
    {fields: {fldName0000000001: 'A'}},
    {fields: {fldName0000000001: 'B', fldTags0000000001: [{id: 'selDev0000000001'}]}},
  ]);
});

test('batches of 50, each permission-checked before the first write', async () => {
  const {table, mutations} = setup();
  const records = ids(BATCH_SIZE * 2 + 20);
  const result = await mutations.removeMany(records);

  assert.equal(result.ok, true);
  assert.deepEqual(result.ids, records);
  assert.deepEqual(
    table.calls.map(([method, payload]) => [method, payload.length]),
    [
      ['check-delete', 50],
      ['check-delete', 50],
      ['check-delete', 20],
      ['delete', 50],
      ['delete', 50],
      ['delete', 20],
    ],
  );
});

test('a denied permission refuses the write before anything is written', async () => {
  const {table, mutations} = setup({deny: {update: 'Read-only interface'}});
  const result = await mutations.updateMany(ids(70).map(record => ({record, fields: {done: true}})));

  assert.equal(result.ok, false);
  assert.match(result.error.message, /Insufficient permissions on "Projects": Read-only interface/);
  assert.deepEqual(result.ids, []);
  assert.equal(result.failedBatch, null);
  assert.deepEqual(writes(table), []);
});

test('a failing batch stops the run and reports what was already written', async () => {
  const {table, mutations} = setup({failWriteCall: 1});
  const result = await mutations.createMany(Array.from({length: 120}, (_, i) => ({name: `R${i}`})));

  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'create failed');
  assert.equal(result.failedBatch, 1);
  assert.equal(result.ids.length, 50, 'the first batch is committed and reported');
  assert.equal(writes(table).length, 2, 'the third batch is never attempted');
});

test('validation errors refuse the whole write: computed, unknown, hidden, retyped', async () => {
  const cases = [
    [{daysLeft: 3}, 'field-not-writable'],
    [{nope: 1}, 'field-unknown'],
  ];
  for (const [values, kind] of cases) {
    const {table, mutations} = setup();
    const result = await mutations.updateFields('rec1', {name: 'ok', ...values});
    assert.equal(result.ok, false, kind);
    assert.deepEqual(
      result.issues.map(issue => issue.kind),
      [kind],
    );
    assert.deepEqual(table.calls, [], `${kind}: no permission check, no write`);
  }

  const hidden = structuredClone(projects);
  hidden.fields = hidden.fields.filter(field => field.id !== 'fldStatus00000001');
  const hiddenResult = await createMutations(fakeTable(hidden), meta).update('rec1', 'status', {name: 'Done'});
  assert.equal(hiddenResult.issues[0].kind, 'field-missing');

  const retyped = structuredClone(projects);
  retyped.fields.find(field => field.id === 'fldBudget00000001').type = 'singleLineText';
  const retypedResult = await createMutations(fakeTable(retyped), meta).update('rec1', 'budget', 5);
  assert.equal(retypedResult.issues[0].kind, 'field-type-changed');
});

test('warnings ride along on success', async () => {
  const {mutations} = setup();
  const result = await mutations.update('rec1', 'weirdField', 'raw');
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.issues.map(issue => [issue.kind, issue.level]),
    [['field-type-unknown', 'warning']],
  );
});

test('a missing table fails every operation and denies every permission, never throws', async () => {
  const mutations = createMutations(null, meta);
  for (const result of [
    await mutations.create({name: 'x'}),
    await mutations.update('rec1', 'name', 'x'),
    await mutations.remove('rec1'),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.issues[0].kind, 'table-missing');
  }
  assert.deepEqual(mutations.can.create(), {
    hasPermission: false,
    reasonDisplayString: 'Table "Projects" is deleted or hidden from this extension.',
  });
});

test('SDK rejections and throwing permission checks become failures', async () => {
  const table = fakeTable(projects);
  table.checkPermissionsForUpdateRecords = () => {
    throw new Error('boom');
  };
  const result = await createMutations(table, meta).update('rec1', 'name', 'x');
  assert.equal(result.ok, false);
  assert.equal(result.error.message, 'boom');
  assert.equal(createMutations(table, meta).can.update().hasPermission, false);

  const rejecting = fakeTable(projects);
  rejecting.deleteRecordsAsync = () => Promise.reject('not an Error');
  const rejected = await createMutations(rejecting, meta).remove('rec1');
  assert.equal(rejected.error.message, 'not an Error');
  assert.equal(rejected.failedBatch, 0);
});

test('can: table-level checks pass through', () => {
  const {mutations} = setup({deny: {delete: 'No deletes'}});
  assert.deepEqual(mutations.can.create(), {hasPermission: true});
  assert.deepEqual(mutations.can.delete(), {hasPermission: false, reasonDisplayString: 'No deletes'});
});

test('methods survive destructuring (hooks hand out a plain object)', async () => {
  const {table, mutations} = setup();
  const {update} = mutations;
  assert.equal((await update('rec1', 'name', 'x')).ok, true);
  assert.equal(writes(table).length, 1);
});

const sourceCells = {
  fldName0000000001: 'Original',
  fldBudget00000001: 1000,
  fldStatus00000001: {id: 'selProg000000001', name: 'In "Progress"', color: 'yellowBright'},
  fldTags0000000001: [],
  fldLinks000000001: [{id: 'recTask1', name: 'Task 1'}],
  fldTeam0000000001: [{id: 'usr1', name: 'A', email: 'a@x'}],
  fldAttach00000001: [{id: 'att1', url: 'https://x/a.png', filename: 'a.png'}],
  fldFormula0000001: 12,
  fldAuto0000000001: 7,
  fldFuture00000001: {raw: true},
};

test('cloneValues: writable, non-empty cells in write shapes; computed, unknown, attachments skipped', () => {
  const values = cloneValues(fakeRecord('recSrc', sourceCells), fakeTable(projects), meta);
  assert.deepEqual(values, {
    name: 'Original',
    budget: 1000,
    status: {id: 'selProg000000001'},
    tasks: [{id: 'recTask1'}],
    team: [{id: 'usr1'}],
  });
});

test('cloneValues: omit, overrides, and overrides on unwritable fields dropped', () => {
  const values = cloneValues({raw: fakeRecord('recSrc', sourceCells)}, fakeTable(projects), meta, {
    omit: ['tasks', 'team'],
    overrides: {name: 'Copy of Original', daysLeft: 1, nope: 2, files: [{url: 'https://x/b.png'}]},
  });
  assert.deepEqual(values, {
    name: 'Copy of Original',
    budget: 1000,
    status: {id: 'selProg000000001'},
    files: [{url: 'https://x/b.png'}],
  });
});

test('clone: creates the copy through the same pipeline', async () => {
  const {table, mutations} = setup();
  const result = await mutations.clone(fakeRecord('recSrc', sourceCells), {overrides: {name: 'Copy'}});

  assert.equal(result.ok, true);
  assert.deepEqual(writes(table), [
    [
      'create',
      [
        {
          fields: {
            fldName0000000001: 'Copy',
            fldBudget00000001: 1000,
            fldStatus00000001: {id: 'selProg000000001'},
            fldLinks000000001: [{id: 'recTask1'}],
            fldTeam0000000001: [{id: 'usr1'}],
          },
        },
      ],
    ],
  ]);
});
