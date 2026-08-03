import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

import {buildAirgenMeta, generateTypeScriptFromBase, GENERATED_HEADER} from '../dist/client/generator.js';
import {computeSchemaSignature} from '../dist/client/schema-signature.js';
import {mockBase} from './fixtures/mock-base.js';
import {linkIntoNodeModules} from './helpers.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = generateTypeScriptFromBase(mockBase);

test('starts with the airgen header the daemon requires', () => {
  assert.ok(code.startsWith(GENERATED_HEADER));
});

test('emits one interface per table with collision-free names', () => {
  assert.match(code, /export interface ProjectsRecord \{/);
  assert.match(code, /export interface MyTableRecord \{/);
  assert.match(code, /export interface MyTable2Record \{/); // "My-Table" collides with "My Table"
  assert.match(code, /export interface T2024PlansRecord \{/); // digit-leading table name
  assert.match(code, /export interface MinhasSolucoesRecord \{/); // accented table name transliterated
});

test('transliterates and camelCases field keys, quoting only when nothing survives', () => {
  assert.match(code, /^ {2}name\?: string;$/m);
  assert.match(code, /^ {2}notes\?: string;$/m); // "Notes!"
  assert.match(code, /^ {2}completion\?: number;$/m); // "Completion %"
  assert.match(code, /^ {2}contactEmail\?: string;$/m); // "Contact Email"
  assert.match(code, /^ {2}id\?: number;$/m); // "ID" — all-caps words fold
  assert.match(code, /^ {2}minhasSolucoes\?: string;$/m); // "minhas soluções"
  assert.match(code, /^ {2}acao\?: boolean;$/m); // "Ação"
  assert.match(code, /^ {2}solucoes\?: string;$/m); // "Soluções" and "Solucoes" collide after
  assert.match(code, /^ {2}solucoes2\?: string;$/m); // transliteration — deduped with a suffix
  assert.match(code, /^ {2}_2024Total\?: number;$/m); // digit-leading field name
  assert.match(code, /^ {2}"🎉"\?: string;$/m); // nothing survives — quoted raw name
  assert.match(code, /Airtable field "Contact Email"/); // raw name kept in the JSDoc
});

test('select fields become literal unions of choice objects with ids and colors', () => {
  assert.match(code, /export type ProjectsStatusChoice = \{ id: "selTodo000000001"; name: "Todo"; color\?: string \}/);
  assert.match(code, /name: "In \\"Progress\\""/); // quotes in choice names survive escaping
  assert.match(code, /^ {2}status\?: ProjectsStatusChoice;$/m);
  assert.match(code, /^ {2}tags\?: ProjectsTagsChoice\[\];$/m);
  // Two tables both have a "Status" select — aliases must not collide
  assert.match(code, /export type T2024PlansStatusChoice = /);
  // Select with no choices falls back to the shared shape
  assert.match(code, /^ {2}emptySelect\?: SelectChoice;$/m);
});

test('maps rich getCellValue shapes, not REST shapes', () => {
  assert.match(code, /^ {2}tasks\?: LinkedRecord\[\];$/m);
  assert.match(code, /^ {2}files\?: Attachment\[\];$/m);
  assert.match(code, /^ {2}owner\?: Collaborator;$/m);
  assert.match(code, /^ {2}team\?: Collaborator\[\];$/m);
  assert.match(code, /^ {2}barcode\?: \{ text: string; type\?: string \};$/m);
  assert.match(code, /^ {2}open\?: \{ label: string; url: string \| null \};$/m);
});

test('resolves formula/rollup/lookup result types, with fallbacks', () => {
  assert.match(code, /^ {2}daysLeft\?: number;$/m);
  assert.match(code, /^ {2}label\?: string;$/m);
  assert.match(code, /^ {2}totalHours\?: number;$/m);
  assert.match(code, /^ {2}taskNames\?: Array<string>;$/m);
  assert.match(code, /^ {2}brokenFormula\?: unknown;$/m);
  assert.match(code, /unmapped: someFutureType/);
  assert.match(code, /^ {2}weirdField\?: unknown;$/m);
});

test('embeds airgenMeta with ids, choices, and the schema signature', () => {
  assert.match(code, /export const airgenMeta = \{/);
  assert.match(code, /"id": "tblProjects000001"/);
  assert.match(code, /"id": "fldStatus00000001"/);
  assert.match(code, /"name": "Days Left"/); // raw field name survives under the sanitized key
  // Choices are a list of {id, name, color?}: the id is the durable handle,
  // the list form survives duplicate choice names, and color rides along for
  // UI consumers of the meta.
  assert.match(code, /"choices": \[\s*\{\s*"id": "selTodo000000001",\s*"name": "Todo",\s*"color": "redBright"\s*\}/);
  assert.match(code, /"version": 1/);
  assert.ok(code.includes(`"signature": "${computeSchemaSignature(mockBase)}"`));
  assert.match(code, /as const;/);
});

test('airgenMeta records the computed result type drift needs to compare', () => {
  const meta = buildAirgenMeta(mockBase);
  const fields = meta.tables.Projects.fields;
  // Everything resolveFieldType() reads must be recorded, or a change to it
  // regenerates the file while checkSchemaDrift stays blind to it.
  assert.deepEqual(fields.daysLeft.result, {type: 'number'});
  assert.deepEqual(fields.taskNames.result, {type: 'singleLineText'});
  assert.equal(fields.brokenFormula.result, undefined); // formula with no result
  assert.deepEqual(fields.status.choices, [
    {id: 'selTodo000000001', name: 'Todo', color: 'redBright'},
    {id: 'selProg000000001', name: 'In "Progress"', color: 'yellowBright'},
    {id: 'selDone000000001', name: 'Done', color: 'greenBright'},
  ]);
  assert.equal(fields.name.choices, undefined);
});

test('airgenMeta carries choice colors for UI consumers, omitting the key when absent', () => {
  const meta = buildAirgenMeta(mockBase);
  assert.equal(meta.version, 1);
  // Mixed field: a colorless choice must not carry an own `color: undefined`
  // key — the in-memory meta and the JSON.stringify'd file must be the same
  // shape (deepEqual distinguishes {color: undefined}; the JSON would hide it).
  assert.deepEqual(meta.tables.Projects.fields.tags.choices, [
    {id: 'selDesign0000001', name: 'Design'},
    {id: 'selDev0000000001', name: 'Dev', color: 'blueBright'},
  ]);
});

test('nested result projections follow options.result recursively', () => {
  const base = structuredClone(mockBase);
  // A lookup of a select: the looked-up choices decide the emitted type.
  base.tables[0].fields.find(field => field.id === 'fldLookup00000001').options.result = {
    type: 'singleSelect',
    options: {
      choices: [
        {id: 'selLk0000000001', name: 'Alpha'},
        {id: 'selLk0000000002', name: 'Beta', color: 'tealBright'},
      ],
    },
  };
  const fields = buildAirgenMeta(base).tables.Projects.fields;
  // Colorless nested choices stay key-free; colored ones keep their color.
  assert.deepEqual(fields.taskNames.result, {
    type: 'singleSelect',
    choices: [
      {id: 'selLk0000000001', name: 'Alpha'},
      {id: 'selLk0000000002', name: 'Beta', color: 'tealBright'},
    ],
  });
});

test('emits TableRecordMap keyed by sanitized table names', () => {
  assert.match(code, /export interface TableRecordMap \{/);
  assert.match(code, /^ {2}Projects: ProjectsRecord;$/m);
  assert.match(code, /^ {2}MyTable2: MyTable2Record;$/m);
  assert.match(code, /export type TableKey = keyof TableRecordMap;/);
});

test('emits ready-to-use hooks bound to the schema', () => {
  assert.match(code, /^import \{createTypedHooks\} from 'airgen';$/m);
  assert.match(code, /^export const \{useRecords, useTable, useSchemaDrift\} = createTypedHooks<TableRecordMap>\(airgenMeta\);$/m);
});

test('hooksModule option overrides the runtime import specifier', () => {
  const custom = generateTypeScriptFromBase(mockBase, {hooksModule: '@acme/airgen'});
  assert.match(custom, /^import \{createTypedHooks\} from '@acme\/airgen';$/m);
});

test('output is deterministic: the same schema generates byte-identical code', async () => {
  // The daemon skips the write (and so the block-run reload) only when the
  // payload matches the file byte-for-byte. Any nondeterminism here — a
  // timestamp was the past offender — turns the first save into an endless
  // write → hot-reload → regenerate loop. Wait out a clock tick so a
  // same-millisecond fluke can't mask a reintroduced timestamp.
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(generateTypeScriptFromBase(mockBase), code);
});

test('signature is stable, order-insensitive, and change-sensitive', () => {
  const original = computeSchemaSignature(mockBase);
  assert.equal(computeSchemaSignature(mockBase), original);

  const reordered = {...mockBase, tables: [...mockBase.tables].reverse()};
  assert.equal(computeSchemaSignature(reordered), original);

  const renamedField = structuredClone(mockBase);
  renamedField.tables[0].fields[0].name = 'Renamed';
  assert.notEqual(computeSchemaSignature(renamedField), original);

  const newChoice = structuredClone(mockBase);
  newChoice.tables[0].fields
    .find(field => field.id === 'fldStatus00000001')
    .options.choices.push({id: 'selNew0000000001', name: 'Blocked'});
  assert.notEqual(computeSchemaSignature(newChoice), original);

  // Choice color is part of the meta now, so a recolor must regenerate the
  // file — even though it never changes the emitted type.
  const recolored = structuredClone(mockBase);
  recolored.tables[0].fields
    .find(field => field.id === 'fldStatus00000001')
    .options.choices[0].color = 'purpleBright';
  assert.notEqual(computeSchemaSignature(recolored), original);
});

test('generated output compiles under tsc --strict, resolving airgen like a consumer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-test-'));
  const file = path.join(dir, 'airtable-schema.ts');
  fs.writeFileSync(file, code, 'utf8');

  // Link the built package (and the deps its .d.ts needs) into the temp dir
  // so `import {createTypedHooks} from 'airgen'` typechecks against the real
  // declarations, exactly as it would in a consumer project.
  linkIntoNodeModules(dir, {
    airgen: projectRoot,
    '@airtable': path.join(projectRoot, 'node_modules', '@airtable'),
    '@types': path.join(projectRoot, 'node_modules', '@types'),
    react: path.join(projectRoot, 'node_modules', 'react'),
  });

  const result = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'es2020',
      '--module',
      'es2020',
      '--moduleResolution',
      'bundler',
      '--jsx',
      'react',
      // Like any real consumer (and this project's own tsconfig): the nested
      // @types/react inside @airtable/blocks conflicts with the top-level one.
      '--skipLibCheck',
      file,
    ],
    // cwd = temp dir so tsc resolves through the temp node_modules only
    {encoding: 'utf8', cwd: dir},
  );
  fs.rmSync(dir, {recursive: true, force: true});
  assert.equal(result.status, 0, `tsc failed:\n${result.stdout}\n${result.stderr}`);
});
