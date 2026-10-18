// Pinned before any Date is built: São Paulo is UTC-3, where `new Date('2026-10-08')`
// is the 7th, so a date-only cell formatted naively shows the previous day.
process.env.TZ = 'America/Sao_Paulo';

import test from 'node:test';
import assert from 'node:assert/strict';

import {buildAirgenMeta} from '../dist/client/generator.js';
import {inspectField} from '../dist/client/runtime/fields.js';
import {formatValue, parseValue} from '../dist/client/runtime/format.js';
import {exampleBase} from './fixtures/example-base.js';
import {fakeRecord} from './fixtures/fake-sdk.js';

const projects = exampleBase.tables[0];
const meta = buildAirgenMeta(exampleBase).tables.Projects;
const en = {locale: 'en-US'};
const br = {locale: 'pt-BR'};

function inspect(fieldKey, live = true) {
  const fieldMeta = meta.fields[fieldKey];
  return inspectField(live ? projects.fields.find(field => field.id === fieldMeta.id) : null, fieldMeta, fieldKey);
}

const brl = {type: 'currency', options: {precision: 2, symbol: 'R$'}};

test('currency: the field symbol and precision, sign before the symbol, separators from the locale', () => {
  assert.equal(formatValue(brl, 1234.5, en), 'R$1,234.50');
  assert.equal(formatValue(brl, 1234.5, br), 'R$1.234,50');
  assert.equal(formatValue(brl, -1234.5, en), '-R$1,234.50');
  assert.equal(formatValue(brl, -0.001, en), 'R$0.00');
  assert.equal(formatValue({type: 'currency', options: {precision: 0, symbol: '$'}}, 1234.56, en), '$1,235');
  assert.equal(inspect('budget').format(98000, en), '$98,000.00');
});

test('number, percent, rating: precision from the field, percent from the fraction', () => {
  assert.equal(formatValue({type: 'number', options: {precision: 1}}, 1234.56, en), '1,234.6');
  assert.equal(formatValue({type: 'number', options: {precision: 3}}, 2, br), '2,000');
  assert.equal(formatValue({type: 'percent', options: {precision: 0}}, 0.5, en), '50%');
  assert.equal(formatValue({type: 'percent', options: {precision: 1}}, 0.1234, en), '12.3%');
  assert.equal(formatValue({type: 'rating', options: {max: 5}}, 4, en), '4');
});

test('duration: every SDK format, from seconds', () => {
  const duration = durationFormat => ({type: 'duration', options: {durationFormat}});
  assert.equal(formatValue(duration('h:mm'), 5400), '1:30');
  assert.equal(formatValue(duration('h:mm:ss'), 5405), '1:30:05');
  assert.equal(formatValue(duration('h:mm:ss.S'), 5405.25), '1:30:05.3');
  assert.equal(formatValue(duration('h:mm:ss.SS'), 5405.25), '1:30:05.25');
  assert.equal(formatValue(duration('h:mm:ss.SSS'), 45.5), '0:00:45.500');
  assert.equal(formatValue(duration('h:mm'), -90), '-0:02');
  assert.equal(formatValue({type: 'duration'}, 36000), '10:00');
});

test('date: a YYYY-MM-DD cell is the same day in every time zone, in the field format', () => {
  assert.equal(new Date('2026-10-08').getDate(), 7, 'precondition: TZ is behind UTC');
  const date = name => ({type: 'date', options: {dateFormat: {name}}});

  assert.equal(formatValue(date('iso'), '2026-10-08'), '2026-10-08');
  assert.equal(formatValue(date('us'), '2026-10-08'), '10/8/2026');
  assert.equal(formatValue(date('european'), '2026-10-08'), '8/10/2026');
  assert.equal(formatValue(date('friendly'), '2026-10-08', en), 'October 8, 2026');
  assert.equal(formatValue(date('local'), '2026-10-08', br), '08/10/2026');
  assert.equal(formatValue({type: 'date'}, '2026-10-08', en), '10/8/2026');
  // A Date is the viewer's calendar day: 23:00 local is still the 8th.
  assert.equal(formatValue(date('iso'), new Date(2026, 9, 8, 23)), '2026-10-08');
  assert.equal(inspect('startDate').format('2026-10-08'), '2026-10-08');
});

test('dateTime: 12- or 24-hour time in the field time zone, overridable', () => {
  const dateTime = (timeFormat, timeZone) => ({
    type: 'dateTime',
    options: {dateFormat: {name: 'iso'}, timeFormat: {name: timeFormat}, timeZone},
  });
  const instant = '2026-10-18T15:05:00.000Z';

  assert.equal(formatValue(dateTime('12hour', 'utc'), instant), '2026-10-18 3:05pm');
  assert.equal(formatValue(dateTime('24hour', 'Asia/Tokyo'), instant), '2026-10-19 00:05');
  assert.equal(formatValue(dateTime('24hour', 'client'), instant), '2026-10-18 12:05');
  assert.equal(formatValue(dateTime('12hour', 'utc'), instant, {timeZone: 'America/New_York'}), '2026-10-18 11:05am');
  assert.equal(formatValue(dateTime('12hour', 'Not/AZone'), '2026-10-18T03:00:00Z'), '2026-10-18 12:00am');
  assert.equal(formatValue({type: 'createdTime'}, instant, en), '10/18/2026 12:05pm');
});

test('formula, rollup and lookup format by their result; lookups join their values', () => {
  assert.equal(inspect('totalHours').format(12.25, en), '12.3');
  assert.equal(inspect('daysLeft').format(4.6, en), '5');
  const lookup = {
    type: 'multipleLookupValues',
    options: {result: {type: 'currency', options: {precision: 0, symbol: '$'}}},
  };
  assert.equal(
    formatValue(
      lookup,
      [
        {linkedRecordId: 'rec1', value: 5},
        {linkedRecordId: 'rec2', value: 7},
      ],
      en,
    ),
    '$5, $7',
  );
  assert.equal(inspect('taskNames').format([{linkedRecordId: 'rec1', value: 'Draft'}]), 'Draft');
});

test('formatting is total: empties, other types, bad values, locales and options', () => {
  assert.equal(formatValue(brl, null), '');
  assert.equal(formatValue(brl, undefined), '');
  assert.equal(formatValue(brl, 'n/a'), 'n/a');
  assert.equal(formatValue(brl, Number.NaN), '');
  assert.equal(formatValue({type: 'date'}, 'not a date'), 'not a date');
  assert.equal(formatValue({type: 'singleSelect'}, {id: 'sel1', name: 'Active'}), 'Active');
  assert.equal(formatValue({type: 'someFutureType'}, 42), '42');
  assert.equal(formatValue({}, 'plain'), 'plain');
  assert.equal(formatValue(brl, 1, {locale: 'not a locale!'}).startsWith('R$1'), true);
  assert.equal(formatValue({type: 'currency', options: null}, 3, en), '3.00');
  assert.equal(formatValue({type: 'formula', options: {}}, 3), '3');
});

test('inspector: a hidden field formats by its generated type, formatCell reads by field', () => {
  assert.equal(inspect('budget', false).format(1234.5, en), '1,234.50');
  assert.equal(inspect('budget', false).formatCell(fakeRecord('rec1', {})), '');

  const budget = inspect('budget');
  const record = fakeRecord('rec1', {fldProjBudget0001: 1234.5});
  assert.equal(budget.formatCell(record, en), '$1,234.50');
  assert.equal(budget.formatCell({raw: record}, br), '$1.234,50');

  const throwing = {
    id: 'rec2',
    name: 'x',
    getCellValue: () => assert.fail('no such field'),
    getCellValueAsString: () => '',
  };
  assert.equal(budget.formatCell(throwing), '');
});

test('parse numbers: locale separators, optional symbol and groups, strict otherwise', () => {
  assert.deepEqual(parseValue(brl, 'R$ 1.234,50', br), {ok: true, value: 1234.5});
  assert.deepEqual(parseValue(brl, '1234,5', br), {ok: true, value: 1234.5});
  assert.deepEqual(parseValue(brl, '-R$1.234', br), {ok: true, value: -1234});
  assert.deepEqual(parseValue(brl, '1,234.5', en), {ok: true, value: 1234.5});
  assert.deepEqual(parseValue(brl, '1.234', en), {ok: true, value: 1.234});
  assert.deepEqual(parseValue({type: 'percent'}, '12.5%', en), {ok: true, value: 0.125});
  assert.deepEqual(parseValue({type: 'percent'}, '7', en), {ok: true, value: 0.07});
  assert.deepEqual(parseValue({type: 'number'}, '-0', en), {ok: true, value: 0});

  for (const bad of ['abc', '12-34', '1,2,3', '1.234,50', '--1', '1e5']) {
    const result = parseValue(brl, bad, en);
    assert.equal(result.ok, false, bad);
    assert.equal(result.error, 'Enter an amount such as R$1,234.50.', bad);
  }
  assert.equal(parseValue(brl, '1234.50', br).ok, false);
  assert.equal(parseValue({type: 'number', options: {precision: 1}}, 'x', br).error, 'Enter a number such as 1.234,5.');
});

test('parse durations and dates into the cell format', () => {
  assert.deepEqual(parseValue({type: 'duration'}, '1:30'), {ok: true, value: 5400});
  assert.deepEqual(parseValue({type: 'duration'}, '1:30:05.5'), {ok: true, value: 5405.5});
  assert.equal(parseValue({type: 'duration'}, '1:75').ok, false);

  const european = {type: 'date', options: {dateFormat: {name: 'european'}}};
  assert.deepEqual(parseValue(european, '31/1/2026'), {ok: true, value: '2026-01-31'});
  assert.deepEqual(parseValue(european, '2026-01-31'), {ok: true, value: '2026-01-31'});
  assert.deepEqual(parseValue({type: 'date'}, '1/31/2026', en), {ok: true, value: '2026-01-31'});
  assert.deepEqual(parseValue({type: 'date'}, '31/01/2026', br), {ok: true, value: '2026-01-31'});
  assert.equal(parseValue(european, '31/02/2026').ok, false);
  assert.equal(parseValue(european, '31/1/26').ok, false);
  assert.equal(parseValue(european, 'soon').error, 'Enter a date such as 31/1/2026.');

  const dateTime = {type: 'dateTime', options: {dateFormat: {name: 'iso'}, timeZone: 'America/New_York'}};
  assert.deepEqual(parseValue(dateTime, '2026-10-18 3:05pm'), {ok: true, value: '2026-10-18T19:05:00.000Z'});
  assert.deepEqual(parseValue(dateTime, '2026-10-18 15:05'), {ok: true, value: '2026-10-18T19:05:00.000Z'});
  assert.deepEqual(parseValue(dateTime, '2026-10-18T15:05:00Z'), {ok: true, value: '2026-10-18T15:05:00.000Z'});
  assert.deepEqual(parseValue({type: 'dateTime'}, '2026-10-18'), {ok: true, value: '2026-10-18T03:00:00.000Z'});
  assert.equal(parseValue(dateTime, '2026-10-18 13:05pm').ok, false);
});

test('parse: empty clears, text passes through, other types refuse', () => {
  assert.deepEqual(parseValue(brl, '  '), {ok: true, value: null});
  assert.deepEqual(parseValue({type: 'singleLineText'}, 'Draft'), {ok: true, value: 'Draft'});
  assert.equal(parseValue({type: 'multipleSelects'}, 'x').ok, false);
  assert.equal(parseValue({}, 'x').ok, false);
});

test('round trip: parse(format(x)) is x in the field format and locale', () => {
  const cases = [
    [brl, 1234.5, br],
    [brl, -98000, en],
    [{type: 'percent', options: {precision: 1}}, 0.125, en],
    [{type: 'duration', options: {durationFormat: 'h:mm:ss'}}, 5405, en],
    [{type: 'date', options: {dateFormat: {name: 'us'}}}, '2026-01-31', en],
    [{type: 'date', options: {dateFormat: {name: 'local'}}}, '2026-01-31', br],
    [{type: 'dateTime', options: {timeFormat: {name: '12hour'}, timeZone: 'utc'}}, '2026-01-31T14:30:00.000Z', en],
  ];
  for (const [source, value, options] of cases) {
    assert.deepEqual(parseValue(source, formatValue(source, value, options), options), {ok: true, value});
  }
});
