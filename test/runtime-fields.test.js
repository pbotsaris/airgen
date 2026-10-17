import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAirgenMeta} from '../dist/client/generator.js';
import {writeKind} from '../dist/client/field-types.js';
import {inspectField} from '../dist/client/runtime/fields.js';
import {ValidationResult} from '../dist/client/runtime/validation.js';
import {
  cellIds,
  cellNames,
  firstLinkedRecord,
  firstLookupValue,
  lookupValues,
} from '../dist/client/runtime/normalize.js';
import {mockBase} from './fixtures/mock-base.js';

const projects = mockBase.tables[0];
const meta = buildAirgenMeta(mockBase).tables.Projects;

/** Inspector for a Projects field key, against the live fixture field. */
function inspect(fieldKey, liveOverride) {
  const fieldMeta = meta.fields[fieldKey];
  const live = liveOverride !== undefined ? liveOverride : projects.fields.find(field => field.id === fieldMeta?.id);
  return inspectField(live ?? null, fieldMeta, fieldKey);
}

test('field-types: every fixture type is known except the future one', () => {
  const unknown = projects.fields.filter(field => writeKind(field.type) === undefined).map(field => field.type);
  assert.deepEqual(unknown, ['someFutureType']);
  assert.equal(writeKind('barcode'), null);
  assert.equal(writeKind('formula'), null);
  assert.equal(writeKind('multipleRecordLinks'), 'links');
});

test('writable and computed fields: isWritable and validation agree with the generated Write interface', () => {
  for (const fieldKey of ['name', 'budget', 'done', 'startDate', 'status', 'tags', 'tasks', 'files', 'owner', 'team']) {
    const inspector = inspect(fieldKey);
    assert.equal(inspector.isWritable, true, fieldKey);
    assert.deepEqual(inspector.validation.issues, [], fieldKey);
  }
  for (const fieldKey of [
    'daysLeft',
    'taskNames',
    'id',
    'created',
    'createdBy',
    'open',
    'summary',
    'syncSource',
    'barcode',
  ]) {
    const inspector = inspect(fieldKey);
    assert.equal(inspector.isWritable, false, fieldKey);
    assert.equal(inspector.validation.valid(), false, fieldKey);
    assert.equal(inspector.validation.issues[0].kind, 'field-not-writable', fieldKey);
  }
});

test('the SDK verdict wins: a text field reported computed is not writable', () => {
  const live = {...projects.fields[0], isComputed: true};
  assert.equal(inspect('name', live).isWritable, false);
});

test('a hidden or deleted field inspects from the meta and blocks writes', () => {
  const inspector = inspect('status', null);
  assert.equal(inspector.field, null);
  assert.equal(inspector.type, 'singleSelect');
  assert.equal(inspector.name, 'Status');
  assert.equal(inspector.choices.length, 3, 'choices fall back to the meta');
  assert.equal(inspector.isWritable, false);
  assert.deepEqual(
    inspector.validation.issues.map(issue => [issue.kind, issue.level, issue.fieldKey]),
    [['field-missing', 'error', 'status']],
  );
});

test('a key missing from the meta is field-unknown', () => {
  const inspector = inspectField(null, undefined, 'nope');
  assert.equal(inspector.validation.issues[0].kind, 'field-unknown');
  assert.equal(inspector.convertTo('x'), 'x', 'never throws');
});

test('a retyped field blocks writes: the generated write type is stale', () => {
  const live = {...projects.fields.find(field => field.id === 'fldBudget00000001'), type: 'singleLineText'};
  const inspector = inspect('budget', live);
  assert.equal(inspector.type, 'singleLineText');
  assert.equal(inspector.validation.issues[0].kind, 'field-type-changed');
});

test('an unknown field type warns but does not block, and passes values through', () => {
  const inspector = inspect('weirdField');
  assert.equal(inspector.writeKind, undefined);
  assert.equal(inspector.validation.valid(), true);
  assert.equal(inspector.validation.warnings[0].kind, 'field-type-unknown');
  const value = {anything: [1, 2]};
  assert.equal(inspector.convertTo(value), value);
});

test('a bare SDK handle (id only) reads type and choices from the meta', () => {
  const inspector = inspect('status', {id: 'fldStatus00000001'});
  assert.equal(inspector.type, 'singleSelect');
  assert.equal(inspector.isWritable, true);
  assert.deepEqual(inspector.convertTo('done'), {id: 'selDone000000001'});
});

test('choices: lookups and formulas unwrap options.result', () => {
  const lookupOfSelect = {
    id: 'fldLookup00000001',
    name: 'Task Status',
    type: 'multipleLookupValues',
    isComputed: true,
    options: {result: {type: 'singleSelect', options: {choices: [{id: 'selA', name: 'A', color: 'red'}]}}},
  };
  const inspector = inspectField(lookupOfSelect, {...meta.fields.taskNames, type: 'multipleLookupValues'});
  assert.equal(inspector.resultType, 'singleSelect');
  assert.deepEqual(inspector.choices, [{id: 'selA', name: 'A', color: 'red'}]);
});

test('choices: colorless choices are kept (no color key)', () => {
  const tags = inspect('tags');
  assert.deepEqual(tags.getChoiceById('selDesign0000001'), {id: 'selDesign0000001', name: 'Design'});
  assert.deepEqual(tags.getChoiceByName('dev'), {id: 'selDev0000000001', name: 'Dev', color: 'blueBright'});
  assert.equal(tags.getChoiceByName('nope'), null);
});

test('convertTo: selects map read shapes, write shapes, ids and names to {id}', () => {
  const status = inspect('status');
  const read = {id: 'selDone000000001', name: 'Done', color: 'greenBright'};
  assert.deepEqual(status.convertTo(read), {id: 'selDone000000001'});
  assert.deepEqual(status.convertTo({id: 'selDone000000001'}), {id: 'selDone000000001'});
  assert.deepEqual(status.convertTo({name: 'In "Progress"'}), {id: 'selProg000000001'});
  assert.deepEqual(status.convertTo('selTodo000000001'), {id: 'selTodo000000001'});
  assert.deepEqual(status.convertTo('TODO'), {id: 'selTodo000000001'}, 'names match case-insensitively');
  assert.deepEqual(status.convertTo('Nope'), {name: 'Nope'}, 'left for the SDK to reject');
  assert.equal(status.convertTo(null), null);
  assert.equal(status.convertTo(undefined), undefined);

  const tags = inspect('tags');
  assert.deepEqual(tags.convertTo([{id: 'selDev0000000001', name: 'Dev', color: 'blueBright'}, 'Design']), [
    {id: 'selDev0000000001'},
    {id: 'selDesign0000001'},
  ]);
  assert.deepEqual(tags.convertTo('Dev'), [{id: 'selDev0000000001'}], 'a lone value becomes a list of one');
});

test('convertTo: links, collaborators, attachments, scalars', () => {
  const tasks = inspect('tasks');
  assert.deepEqual(tasks.convertTo([{id: 'rec1', name: 'One'}, 'rec2', {name: 'New task'}]), [
    {id: 'rec1'},
    {id: 'rec2'},
    {name: 'New task'},
  ]);
  assert.deepEqual(inspect('owner').convertTo({id: 'usr1', email: 'a@b.c', name: 'A'}), {id: 'usr1'});
  assert.deepEqual(inspect('team').convertTo([{id: 'usr1', name: 'A'}, 'usr2']), [{id: 'usr1'}, {id: 'usr2'}]);

  const files = [{id: 'att1', url: 'https://x/y.png', filename: 'y.png'}, {url: 'https://x/z.png'}];
  assert.equal(inspect('files').convertTo(files), files);
  assert.equal(inspect('completion').convertTo(0.25), 0.25, 'percent stays a fraction');
  const date = new Date('2026-10-17');
  assert.equal(inspect('startDate').convertTo(date), date);
});

test('convertTo is idempotent for every writable kind', () => {
  const samples = {
    status: {id: 'selDone000000001', name: 'Done', color: 'greenBright'},
    tags: [{id: 'selDev0000000001', name: 'Dev'}],
    tasks: [{id: 'rec1', name: 'One'}],
    owner: {id: 'usr1', name: 'A'},
    team: [{id: 'usr1', name: 'A'}],
    name: 'hello',
    budget: 12.5,
  };
  for (const [fieldKey, value] of Object.entries(samples)) {
    const inspector = inspect(fieldKey);
    const once = inspector.convertTo(value);
    assert.deepEqual(inspector.convertTo(once), once, fieldKey);
  }
});

test('ValidationResult: errors block, warnings do not, merge keeps order', () => {
  const warning = {kind: 'field-type-unknown', level: 'warning', message: 'w'};
  const error = {kind: 'field-missing', level: 'error', message: 'e'};
  assert.equal(ValidationResult.ok.valid(), true);
  assert.equal(new ValidationResult([warning]).valid(), true);

  const merged = ValidationResult.merge([
    new ValidationResult([warning]),
    ValidationResult.ok,
    new ValidationResult([error]),
  ]);
  assert.equal(merged.valid(), false);
  assert.deepEqual(merged.errors, [error]);
  assert.deepEqual(merged.warnings, [warning]);
  assert.equal(merged.reason(), 'w\ne');
  assert.equal(ValidationResult.merge([ValidationResult.ok]), ValidationResult.ok);
});

test('normalize: lookups unwrap {linkedRecordId, value} entries and bare values alike', () => {
  const cell = [
    {linkedRecordId: 'rec1', value: 'A'},
    {linkedRecordId: 'rec2', value: null},
    {linkedRecordId: 'rec3', value: 'C'},
  ];
  assert.deepEqual(lookupValues(cell), ['A', 'C']);
  assert.deepEqual(lookupValues(['A', 'B']), ['A', 'B']);
  assert.equal(firstLookupValue(cell), 'A');
  assert.equal(firstLookupValue(null), null);
  assert.deepEqual(lookupValues(undefined), []);

  // An aiText value has its own `value` key; only lookup entries are unwrapped.
  const ai = {state: 'generated', value: 'text', isStale: false};
  assert.deepEqual(lookupValues([ai]), [ai]);
});

test('normalize: ids, names, first link', () => {
  const links = [{id: 'rec1', name: 'One'}, {id: 'rec2'}];
  assert.deepEqual(cellIds(links), ['rec1', 'rec2']);
  assert.deepEqual(cellNames(links), ['One']);
  assert.deepEqual(cellIds({id: 'sel1', name: 'A'}), ['sel1']);
  assert.deepEqual(cellIds(null), []);
  assert.deepEqual(firstLinkedRecord(links), {id: 'rec1', name: 'One'});
  assert.equal(firstLinkedRecord([]), null);
});
