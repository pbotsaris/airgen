import test from 'node:test';
import assert from 'node:assert/strict';

import {cellText, containsMatcher, groupRecords, query} from '../dist/client/runtime/queries.js';

// `useRecords` rows: empty cells are absent from `fields`.
const todo = {id: 'selTodo', name: 'Todo', color: 'red'};
const done = {id: 'selDone', name: 'Done', color: 'green'};
const records = [
  {
    id: 'rec1',
    fields: {name: 'São Paulo launch', status: done, tags: [{id: 'selDev', name: 'Dev'}], budget: 100, done: true},
  },
  {
    id: 'rec2',
    fields: {
      name: 'Lisbon pilot',
      status: todo,
      tags: [
        {id: 'selDev', name: 'Dev'},
        {id: 'selDes', name: 'Design'},
      ],
    },
  },
  {id: 'rec3', fields: {name: 'Berlin', status: todo, owner: {id: 'usr1', name: 'Ana', email: 'ana@x.io'}}},
  {
    id: 'rec4',
    fields: {name: 'Porto', taskNames: [{linkedRecordId: 'recT1', value: 'Kickoff'}], budget: 0},
  },
];
const ids = list => list.map(record => record.id);

test('is / not match selects by name or id, arrays by any element', () => {
  assert.deepEqual(ids(query(records, {where: [{field: 'status', op: 'is', value: 'Todo'}]})), ['rec2', 'rec3']);
  assert.deepEqual(ids(query(records, {where: [{field: 'status', op: 'is', value: 'selDone'}]})), ['rec1']);
  assert.deepEqual(ids(query(records, {where: [{field: 'tags', op: 'is', value: 'Design'}]})), ['rec2']);
  assert.deepEqual(ids(query(records, {where: [{field: 'status', op: 'not', value: 'Todo'}]})), ['rec1', 'rec4']);
});

test('anyOf / noneOf, collaborators by email, lookups by value, numbers as strings', () => {
  assert.deepEqual(ids(query(records, {where: [{field: 'status', op: 'anyOf', value: ['Done', 'selTodo']}]})), [
    'rec1',
    'rec2',
    'rec3',
  ]);
  assert.deepEqual(ids(query(records, {where: [{field: 'tags', op: 'noneOf', value: ['Dev']}]})), ['rec3', 'rec4']);
  assert.deepEqual(ids(query(records, {where: [{field: 'owner', op: 'is', value: 'ana@x.io'}]})), ['rec3']);
  assert.deepEqual(ids(query(records, {where: [{field: 'taskNames', op: 'is', value: 'Kickoff'}]})), ['rec4']);
  assert.deepEqual(ids(query(records, {where: [{field: 'budget', op: 'is', value: 0}]})), ['rec4']);
  assert.deepEqual(ids(query(records, {where: [{field: 'done', op: 'is', value: true}]})), ['rec1']);
});

test('empty / notEmpty treat absent, null, "" and [] as empty', () => {
  const rows = [
    {id: 'a', fields: {}},
    {id: 'b', fields: {tags: []}},
    {id: 'c', fields: {tags: ''}},
    {id: 'd', fields: {tags: [{id: 'x', name: 'X'}]}},
  ];
  assert.deepEqual(ids(query(rows, {where: [{field: 'tags', op: 'empty'}]})), ['a', 'b', 'c']);
  assert.deepEqual(ids(query(rows, {where: [{field: 'tags', op: 'notEmpty'}]})), ['d']);
});

test('match: all (default) vs any', () => {
  const where = [
    {field: 'status', op: 'is', value: 'Todo'},
    {field: 'tags', op: 'is', value: 'Dev'},
  ];
  assert.deepEqual(ids(query(records, {where})), ['rec2']);
  assert.deepEqual(ids(query(records, {where, match: 'any'})), ['rec1', 'rec2', 'rec3']);
});

test('no spec returns a copy of every record', () => {
  const all = query(records);
  assert.deepEqual(ids(all), ['rec1', 'rec2', 'rec3', 'rec4']);
  assert.notEqual(all, records);
});

test('search: default matcher is token-based and ignores case and accents', () => {
  const search = q => ids(query(records, {search: {query: q, fields: ['name', 'status']}}));
  assert.deepEqual(search('sao'), ['rec1']);
  assert.deepEqual(search('LAUNCH paulo'), ['rec1']);
  assert.deepEqual(search('todo'), ['rec2', 'rec3'], 'select cells search by name');
  assert.deepEqual(search('   '), ['rec1', 'rec2', 'rec3', 'rec4'], 'blank query is no search');
  assert.deepEqual(search('nowhere'), []);
});

test('search runs after filters and uses an injected matcher (fuse-style ranking)', () => {
  const calls = [];
  // Ranks by reverse order, the way a scoring matcher would reorder.
  const matcher = (texts, q) => {
    calls.push([texts, q]);
    return texts.map((_, index) => index).reverse();
  };
  const result = query(records, {
    where: [{field: 'status', op: 'is', value: 'Todo'}],
    search: {query: 'x', fields: ['name'], matcher},
  });
  assert.deepEqual(ids(result), ['rec3', 'rec2']);
  assert.deepEqual(calls, [[['Lisbon pilot', 'Berlin'], 'x']], 'the matcher only sees filtered records');
});

test('search ignores out-of-range indices from a matcher', () => {
  const result = query(records, {search: {query: 'x', fields: ['name'], matcher: () => [9, -1, 0]}});
  assert.deepEqual(ids(result), ['rec1']);
});

test('containsMatcher and cellText', () => {
  assert.deepEqual(containsMatcher(['Ação', 'acao', 'other'], 'AÇÃO'), [0, 1]);
  assert.equal(
    cellText([
      {id: 'a', name: 'A'},
      {id: 'b', name: 'B'},
    ]),
    'A, B',
  );
  assert.equal(cellText([{linkedRecordId: 'r', value: 'V'}]), 'V');
  assert.equal(cellText({text: '123', type: 'upce'}), '123');
  assert.equal(cellText(42), '42');
  assert.equal(cellText(null), '');
});

test('groupRecords: one field, multi-values explode, empties grouped as null', () => {
  const groups = groupRecords(records, {fields: ['tags']});
  assert.deepEqual(
    groups.map(group => [group.values, ids(group.records)]),
    [
      [['Dev'], ['rec1', 'rec2']],
      [['Design'], ['rec2']],
      [[null], ['rec3', 'rec4']],
    ],
  );
  assert.equal(groups[0].key, '["Dev"]');
});

test('groupRecords: several fields group by every combination; by id', () => {
  const groups = groupRecords(records.slice(0, 2), {fields: ['status', 'tags'], by: 'id'});
  assert.deepEqual(
    groups.map(group => [group.values, ids(group.records)]),
    [
      [['selDone', 'selDev'], ['rec1']],
      [['selTodo', 'selDes'], ['rec2']],
      [['selTodo', 'selDev'], ['rec2']],
    ],
  );
});
