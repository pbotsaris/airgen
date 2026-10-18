import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

import {buildAirgenMeta, generateTypeScriptFromBase, GENERATED_HEADER, META_VERSION} from '../dist/client/generator.js';
import {computeSchemaSignature} from '../dist/client/schema-signature.js';
import {mockBase} from './fixtures/mock-base.js';
import {exampleBase} from './fixtures/example-base.js';
import {linkIntoNodeModules} from './helpers.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = path.join(projectRoot, 'test', 'fixtures');
const code = generateTypeScriptFromBase(mockBase);
const interfaceCode = generateTypeScriptFromBase(mockBase, {hooksModule: 'airgen/interface'});
// examples/ is written against the generated file of a small, generic base;
// that file is a golden copy too, and the examples compile against it below.
const examplesDir = path.join(projectRoot, 'examples');
const exampleSchemaPath = path.join(examplesDir, 'airtable-schema.ts');
const exampleCode = generateTypeScriptFromBase(exampleBase);
/** The `<Table>Write` section of a generated file (everything between the Record interfaces and the meta). */
const writeSection = source =>
  source.slice(source.indexOf('export interface ProjectsWrite {'), source.indexOf('export const airgenMeta'));

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
  assert.match(code, /^ {2}summary\?: AiText;$/m); // aiText
  assert.match(code, /^ {2}syncSource\?: SelectChoice;$/m); // externalSyncSource
  assert.match(code, /export interface AiText \{\n {2}state: 'empty' \| 'loading' \| 'generated' \| 'error';/);
});

test('emits one Write interface per table with only writable fields, in the SDK cell write formats', () => {
  assert.match(code, /export interface ProjectsWrite \{/);
  assert.match(code, /export interface MinhasSolucoesWrite \{/);
  const write = code.slice(
    code.indexOf('export interface ProjectsWrite {'),
    code.indexOf('export interface MyTableWrite {'),
  );

  // Scalars admit null (clearing the cell); dates also take a Date.
  assert.match(write, /^ {2}name\?: string \| null;$/m);
  assert.match(write, /^ {2}budget\?: number \| null;$/m);
  assert.match(write, /^ {2}done\?: boolean \| null;$/m);
  assert.match(write, /^ {2}startDate\?: string \| Date \| null;$/m);
  // Selects: {id} | {name} with literals indexed off the read alias; no alias → plain strings.
  assert.match(
    write,
    /^ {2}status\?: \{ id: ProjectsStatusChoice\['id'\] \} \| \{ name: ProjectsStatusChoice\['name'\] \} \| null;$/m,
  );
  assert.match(
    write,
    /^ {2}tags\?: Array<\{ id: ProjectsTagsChoice\['id'\] \} \| \{ name: ProjectsTagsChoice\['name'\] \}> \| null;$/m,
  );
  assert.match(write, /^ {2}emptySelect\?: \{ id: string \} \| \{ name: string \} \| null;$/m);
  // Collaborators by id, links by id (name optional), attachments new-by-url or as read.
  assert.match(write, /^ {2}owner\?: \{ id: string \} \| null;$/m);
  assert.match(write, /^ {2}team\?: Array<\{ id: string \}> \| null;$/m);
  assert.match(write, /^ {2}tasks\?: Array<\{ id: string; name\?: string \}> \| null;$/m);
  assert.match(write, /^ {2}files\?: Array<\{ url: string; filename\?: string \} \| Attachment> \| null;$/m);
  // Unknown non-computed types stay addressable.
  assert.match(write, /^ {2}weirdField\?: unknown;$/m);

  // Computed fields, and barcode (no SDK write format), are omitted — not `never`.
  for (const key of [
    'daysLeft',
    'label',
    'brokenFormula',
    'totalHours',
    'taskNames',
    'taskCount',
    'id',
    'created',
    'modified',
    'createdBy',
    'modifiedBy',
    'open',
    'summary',
    'syncSource',
    'barcode',
  ]) {
    assert.doesNotMatch(write, new RegExp(`^ {2}${key}\\?:`, 'm'), `${key} should not be writable`);
  }

  assert.match(code, /export interface TableWriteMap \{\n {2}Projects: ProjectsWrite;\n {2}MyTable: MyTableWrite;/);
});

test("the SDK's isComputed verdict wins over the type-based fallback", () => {
  const base = structuredClone(mockBase);
  // e.g. a text field in a synced table the SDK reports as computed
  base.tables[0].fields.find(field => field.id === 'fldEmail000000001').isComputed = true;
  const out = generateTypeScriptFromBase(base);
  assert.doesNotMatch(writeSection(out), /contactEmail\?:/);
  // The read side is unaffected.
  assert.match(out, /^ {2}contactEmail\?: string;$/m);
});

test('interface flavor admits create-by-name record links; stable and base do not', () => {
  assert.match(interfaceCode, /^ {2}tasks\?: Array<\{ id: string; name\?: string \} \| \{ name: string \}> \| null;$/m);
  assert.match(code, /^ {2}tasks\?: Array<\{ id: string; name\?: string \}> \| null;$/m);
  const baseFlavor = generateTypeScriptFromBase(mockBase, {hooksModule: 'airgen/base'});
  assert.match(baseFlavor, /^ {2}tasks\?: Array<\{ id: string; name\?: string \}> \| null;$/m);
  // sdkFlavor is explicit when hooksModule is a custom alias.
  const aliased = generateTypeScriptFromBase(mockBase, {hooksModule: '@acme/airgen', sdkFlavor: 'interface'});
  assert.match(aliased, /^import \{createTypedHooks\} from '@acme\/airgen';$/m);
  assert.match(aliased, /\| \{ name: string \}> \| null;$/m);
  // Flavor changes nothing else: same read types, same meta.
  assert.equal(
    interfaceCode.replace(/^import .*$/m, '').replace(/ \| \{ name: string \}> \| null;/g, '> | null;'),
    code.replace(/^import .*$/m, ''),
  );
});

test('resolves formula/rollup/lookup result types, with fallbacks', () => {
  assert.match(code, /^ {2}daysLeft\?: number;$/m);
  assert.match(code, /^ {2}label\?: string;$/m);
  assert.match(code, /^ {2}totalHours\?: number;$/m);
  assert.match(code, /^ {2}taskNames\?: Array<LookupValue<string>>;$/m);
  assert.match(code, /^export interface LookupValue<T> \{\n {2}linkedRecordId: string;\n {2}value: T;\n\}$/m);
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
  assert.match(code, /"version": 2/);
  assert.match(code, /"primaryFieldId": "fldName0000000001"/);
  assert.match(code, /"type": "formula",\s*"isComputed": true/);
  assert.match(code, /"type": "singleLineText",\s*"isComputed": false/);
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
  assert.equal(meta.version, META_VERSION);
  assert.equal(META_VERSION, 2);
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

test('airgenMeta v2 records isComputed and primaryFieldId, omitting both when the source lacks them', () => {
  const meta = buildAirgenMeta(mockBase);
  assert.equal(meta.tables.Projects.primaryFieldId, 'fldName0000000001');
  assert.equal(meta.tables.Projects.fields.name.isComputed, false);
  assert.equal(meta.tables.Projects.fields.daysLeft.isComputed, true);
  assert.equal(meta.tables.Projects.fields.barcode.isComputed, false); // not computed, just unwritable
  // Key order is what the file shows: id, name, type, isComputed, then the type projection.
  assert.deepEqual(Object.keys(meta.tables.Projects.fields.status), ['id', 'name', 'type', 'isComputed', 'choices']);

  // A plain BaseLike without the SDK flags (older callers, hand-written fixtures)
  // gets no keys at all — never `isComputed: undefined`, which JSON would hide.
  const bare = structuredClone(mockBase);
  for (const table of bare.tables) {
    delete table.primaryField;
    for (const field of table.fields) delete field.isComputed;
  }
  const bareMeta = buildAirgenMeta(bare);
  assert.equal('primaryFieldId' in bareMeta.tables.Projects, false);
  assert.equal('isComputed' in bareMeta.tables.Projects.fields.name, false);
  assert.equal(bareMeta.version, 2);
  // Writability then falls back to the field type, so the Write interfaces are unchanged.
  assert.equal(writeSection(generateTypeScriptFromBase(bare)), writeSection(code));
});

test('isComputed and primaryField are not signature inputs, and write types read nothing new from options', () => {
  const original = computeSchemaSignature(mockBase);

  const flipped = structuredClone(mockBase);
  flipped.tables[0].primaryField = {id: 'fldNotes000000001'};
  for (const field of flipped.tables[0].fields) field.isComputed = !field.isComputed;
  assert.equal(computeSchemaSignature(flipped), original);

  // The three-way coupling (CLAUDE.md): relevantOptions captures exactly
  // `choices` and `result`. Stripping every other option must leave both the
  // signature and the emitted Write interfaces untouched — if a write type ever
  // starts reading another option, this is the test that fails first.
  const stripped = structuredClone(mockBase);
  for (const table of stripped.tables) {
    for (const field of table.fields) {
      if (!field.options) continue;
      const kept = {};
      if ('choices' in field.options) kept.choices = field.options.choices;
      if ('result' in field.options) kept.result = field.options.result;
      field.options = kept;
    }
  }
  assert.equal(computeSchemaSignature(stripped), original);
  assert.equal(writeSection(generateTypeScriptFromBase(stripped)), writeSection(code));
});

test('matches the golden snapshot (UPDATE_SNAPSHOTS=1 to refresh after an intended change)', () => {
  const snapshotPath = path.join(fixturesDir, 'snapshots', 'mock-base.airtable-schema.ts');
  if (process.env.UPDATE_SNAPSHOTS) fs.writeFileSync(snapshotPath, code, 'utf8');
  const expected = fs.readFileSync(snapshotPath, 'utf8');
  assert.equal(code, expected, `generated output differs from ${path.relative(projectRoot, snapshotPath)}`);
});

test('examples/airtable-schema.ts is the generated file of the example base (UPDATE_SNAPSHOTS=1 to refresh)', () => {
  if (process.env.UPDATE_SNAPSHOTS) fs.writeFileSync(exampleSchemaPath, exampleCode, 'utf8');
  const expected = fs.readFileSync(exampleSchemaPath, 'utf8');
  assert.equal(exampleCode, expected, `generated output differs from ${path.relative(projectRoot, exampleSchemaPath)}`);
});

test('emits TableRecordMap keyed by sanitized table names', () => {
  assert.match(code, /export interface TableRecordMap \{/);
  assert.match(code, /^ {2}Projects: ProjectsRecord;$/m);
  assert.match(code, /^ {2}MyTable2: MyTable2Record;$/m);
  assert.match(code, /export type TableKey = keyof TableRecordMap;/);
});

test('emits ready-to-use hooks bound to the schema', () => {
  assert.match(code, /^import \{createTypedHooks\} from 'airgen';$/m);
  assert.match(
    code,
    /^export const \{useRecords, useTable, useSchemaDrift, useFields, useMutations, useQuery\} = createTypedHooks<TableRecordMap, TableWriteMap>\(airgenMeta\);$/m,
  );
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
  recolored.tables[0].fields.find(field => field.id === 'fldStatus00000001').options.choices[0].color = 'purpleBright';
  assert.notEqual(computeSchemaSignature(recolored), original);
});

test('generated output compiles under tsc --strict, resolving airgen like a consumer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-test-'));
  const file = path.join(dir, 'airtable-schema.ts');
  fs.writeFileSync(file, code, 'utf8');
  // The interface flavor resolves 'airgen/interface' through the exports map;
  // its .d.ts has no SDK imports (entries.test.js), so the stable devDependency suffices.
  const interfaceFile = path.join(dir, 'airtable-schema-interface.ts');
  fs.writeFileSync(interfaceFile, interfaceCode, 'utf8');
  // Consumer-style assertions on the write types: positive cases compile and
  // each `@ts-expect-error` is a real error (tsc fails on an unused one).
  const consumers = ['write-types.ts', 'write-types-interface.ts', 'hooks.ts'].map(name => {
    const target = path.join(dir, name);
    fs.copyFileSync(path.join(fixturesDir, 'consumers', name), target);
    return target;
  });
  // The examples, next to their own generated schema, so `./airtable-schema`
  // resolves to the example base's file and the examples can't rot.
  const examplesTmp = path.join(dir, 'examples');
  fs.mkdirSync(examplesTmp);
  fs.writeFileSync(path.join(examplesTmp, 'airtable-schema.ts'), exampleCode, 'utf8');
  const examples = fs
    .readdirSync(examplesDir)
    .filter(name => /\.tsx?$/.test(name) && name !== 'airtable-schema.ts')
    .map(name => {
      const target = path.join(examplesTmp, name);
      fs.copyFileSync(path.join(examplesDir, name), target);
      return target;
    });
  assert.ok(examples.length > 0, 'examples/ has example files');

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
      interfaceFile,
      ...consumers,
      ...examples,
    ],
    // cwd = temp dir so tsc resolves through the temp node_modules only
    {encoding: 'utf8', cwd: dir},
  );
  fs.rmSync(dir, {recursive: true, force: true});
  assert.equal(result.status, 0, `tsc failed:\n${result.stdout}\n${result.stderr}`);
});
