import test from 'node:test';
import assert from 'node:assert/strict';

import {checkSchemaDrift} from '../dist/client/schema-drift.js';
import {buildAirgenMeta} from '../dist/client/generator.js';
import {mockBase} from './fixtures/mock-base.js';

// The exact meta a generated file would bake in for the fixture base.
const meta = buildAirgenMeta(mockBase);

test('unchanged base has no drift', () => {
  const report = checkSchemaDrift(mockBase, meta);
  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.counts, {breaking: 0, warning: 0, info: 0});
});

test('deleted field is breaking, keyed by sanitized names', () => {
  const base = structuredClone(mockBase);
  base.tables[0].fields = base.tables[0].fields.filter(field => field.id !== 'fldEmail000000001');

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.ok, false);
  assert.equal(report.findings.length, 1);
  const [finding] = report.findings;
  assert.equal(finding.kind, 'field-missing');
  assert.equal(finding.severity, 'breaking');
  assert.equal(finding.tableKey, 'Projects');
  assert.equal(finding.fieldKey, 'contactEmail');
  assert.equal(finding.fieldName, 'Contact Email');
});

test('deleted table is breaking', () => {
  const base = structuredClone(mockBase);
  base.tables = base.tables.filter(table => table.id !== 'tblMyTable00000002');

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.counts.breaking, 1);
  const [finding] = report.findings;
  assert.equal(finding.kind, 'table-missing');
  assert.equal(finding.tableKey, 'MyTable2');
  assert.equal(finding.tableName, 'My-Table');
});

test('changed field type is breaking and reports old → new', () => {
  const base = structuredClone(mockBase);
  base.tables[0].fields.find(field => field.id === 'fldStatus00000001').type = 'multilineText';

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.counts.breaking, 1);
  const [finding] = report.findings;
  assert.equal(finding.kind, 'field-type-changed');
  assert.equal(finding.expected, 'singleSelect');
  assert.equal(finding.actual, 'multilineText');
  // A type change reports once — no cascading choice findings for the same field.
  assert.equal(report.findings.length, 1);
});

test('renames (id kept) are info, not breaking', () => {
  const base = structuredClone(mockBase);
  base.tables[0].name = 'Projekte';
  base.tables[0].fields.find(field => field.id === 'fldName0000000001').name = 'Title';

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.counts.breaking, 0);
  assert.equal(report.counts.info, 2);
  const kinds = report.findings.map(finding => finding.kind).sort();
  assert.deepEqual(kinds, ['field-renamed', 'table-renamed']);
  const renamed = report.findings.find(finding => finding.kind === 'field-renamed');
  assert.equal(renamed.expected, 'Name');
  assert.equal(renamed.actual, 'Title');
});

test('removed select choice is a warning naming the choice', () => {
  const base = structuredClone(mockBase);
  const status = base.tables[0].fields.find(field => field.id === 'fldStatus00000001');
  status.options.choices = status.options.choices.filter(choice => choice.id !== 'selProg000000001');

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.counts.warning, 1);
  const [finding] = report.findings;
  assert.equal(finding.kind, 'choice-removed');
  assert.equal(finding.expected, 'In "Progress"');
  assert.equal(finding.fieldKey, 'status');
});

test('choice renamed in place (id kept) is not reported as removed', () => {
  const base = structuredClone(mockBase);
  const status = base.tables[0].fields.find(field => field.id === 'fldStatus00000001');
  status.options.choices.find(choice => choice.id === 'selTodo000000001').name = 'Backlog';

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.counts.warning, 0);
});

test('additions in the base are not drift', () => {
  const base = structuredClone(mockBase);
  base.tables[0].fields.push({id: 'fldNew0000000001', name: 'Brand New', type: 'singleLineText'});
  base.tables[0].fields
    .find(field => field.id === 'fldStatus00000001')
    .options.choices.push({id: 'selNew0000000001', name: 'Blocked'});
  base.tables.push({
    id: 'tblNew00000000001',
    name: 'New Table',
    fields: [{id: 'fldNt100000000001', name: 'Name', type: 'singleLineText'}],
  });

  const report = checkSchemaDrift(base, meta);
  assert.equal(report.ok, true);
});

test('tolerates old metas without fieldMeta.name (no rename detection, no throw)', () => {
  const oldMeta = structuredClone(meta);
  delete oldMeta.tables.Projects.fields.contactEmail.name;

  const base = structuredClone(mockBase);
  base.tables[0].fields.find(field => field.id === 'fldEmail000000001').name = 'Customer Email';

  const report = checkSchemaDrift(base, oldMeta);
  assert.equal(report.ok, true);
});

test('findings sort breaking → warning → info regardless of schema order', () => {
  const base = structuredClone(mockBase);
  // info first in document order (table rename on the first table)...
  base.tables[0].name = 'Projekte';
  // ...warning next (choice removed)...
  const status = base.tables[0].fields.find(field => field.id === 'fldStatus00000001');
  status.options.choices = status.options.choices.filter(choice => choice.id !== 'selDone000000001');
  // ...breaking last in document order (field deleted from the last table).
  const plans = base.tables.find(table => table.id === 'tbl2024Plans000001');
  plans.fields = plans.fields.filter(field => field.id !== 'fldPlan0000000001');

  const report = checkSchemaDrift(base, meta);
  assert.deepEqual(
    report.findings.map(finding => finding.severity),
    ['breaking', 'warning', 'info'],
  );
  assert.deepEqual(report.counts, {breaking: 1, warning: 1, info: 1});
});

test('never throws on degenerate inputs', () => {
  assert.equal(checkSchemaDrift({id: 'app', tables: []}, {tables: {}}).ok, true);
  // A base with zero tables against a full meta: everything is missing, nothing throws.
  const report = checkSchemaDrift({id: 'app', tables: []}, meta);
  assert.equal(report.ok, false);
  assert.ok(report.findings.every(finding => finding.kind === 'table-missing'));
});
