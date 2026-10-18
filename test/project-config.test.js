import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  applyConfigFix,
  fixCommand,
  parseJsonc,
  planConfigFix,
  recommendedConfig,
} from '../src/daemon/project-config.js';
import {STUB_SOURCE, isStub, writeStubIfMissing} from '../src/daemon/stub.js';
import {GENERATED_HEADER, META_VERSION, generateTypeScriptFromBase} from '../dist/client/generator.js';
import {mockBase} from './fixtures/mock-base.js';
import {diffGeneratedFiles} from '../src/daemon/schema-diff.js';

/** The blocks scaffold: sources in frontend/, the generated file beside them. */
function makeProject({config, configName = 'tsconfig.json', files = {'frontend/App.jsx': 'export {};\n'}} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-config-test-'));
  test.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), {recursive: true});
    fs.writeFileSync(path.join(dir, file), text);
  }
  fs.mkdirSync(path.join(dir, 'frontend'), {recursive: true});
  if (config !== undefined) {
    fs.writeFileSync(path.join(dir, configName), typeof config === 'string' ? config : JSON.stringify(config));
  }
  return {dir, outPath: path.join(dir, 'frontend', 'airtable-schema.ts')};
}

const options = plan => Object.fromEntries(plan.changes.map(change => [change.option, change.value]));

test('parseJsonc accepts comments and trailing commas, and keeps them inside strings', () => {
  const parsed = parseJsonc(`{
    // line comment
    "a": "http://x // not a comment", /* block */
    "b": [1, 2,],
    "c": "say \\"hi\\", ok",
  }`);
  assert.deepEqual(parsed, {a: 'http://x // not a comment', b: [1, 2], c: 'say "hi", ok'});
  assert.throws(() => parseJsonc('{"a": }'));
});

test('no config: plans the recommended one at the project root, including the output dir', () => {
  const {dir, outPath} = makeProject();
  const plan = planConfigFix({cwd: dir, outPath});
  assert.equal(plan.action, 'create');
  assert.equal(plan.configPath, path.join(dir, 'tsconfig.json'));
  assert.deepEqual(plan.next, recommendedConfig('frontend'));

  const result = applyConfigFix(plan);
  assert.equal(result.action, 'created');
  assert.deepEqual(JSON.parse(fs.readFileSync(plan.configPath, 'utf8')), recommendedConfig('frontend'));
  assert.equal(planConfigFix({cwd: dir, outPath}).action, 'none', 'the recommended config needs nothing');
});

test('no config and an output outside the cwd: creates nothing', () => {
  const {outPath} = makeProject();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-config-cwd-'));
  test.after(() => fs.rmSync(elsewhere, {recursive: true, force: true}));
  const plan = planConfigFix({cwd: elsewhere, outPath});
  assert.equal(plan.action, 'none');
  assert.equal(plan.configPath, null);
  assert.equal(applyConfigFix(plan).action, 'unchanged');
});

test('the afsp_profit_loss config: include, jsx and NodeNext are all planned', () => {
  const {dir, outPath} = makeProject({
    config: {
      compilerOptions: {module: 'NodeNext', moduleResolution: 'NodeNext', allowJs: true, checkJs: true, strict: true},
      include: ['src/**/*.js'],
      exclude: ['node_modules', 'dist'],
    },
  });
  const plan = planConfigFix({cwd: dir, outPath});
  assert.equal(plan.action, 'update');
  assert.deepEqual(options(plan), {
    include: ['src/**/*.js', 'frontend'],
    jsx: 'react-jsx',
    moduleResolution: 'Bundler',
  });
  assert.equal(plan.next.compilerOptions.module, 'ESNext');
  assert.deepEqual(plan.next.exclude, ['node_modules', 'dist'], 'untouched keys survive');
  assert.deepEqual(plan.notes, []);
});

test('include patterns follow tsc: directories, ** globs, extensions, and excludes', () => {
  const covered = include => {
    const {dir, outPath} = makeProject({config: {compilerOptions: {allowJs: true, jsx: 'react-jsx'}, include}});
    return !planConfigFix({cwd: dir, outPath}).changes.some(change => change.option === 'include');
  };
  assert.ok(covered(['frontend']));
  assert.ok(covered(['./frontend/']));
  assert.ok(covered(['frontend/**']));
  assert.ok(covered(['**/*']));
  assert.ok(covered(['frontend/**/*.jsx', 'frontend/**/*.ts']));
  assert.ok(!covered(['frontend/**/*.js']), '*.js does not match App.jsx');
  assert.ok(!covered(['src']));
  assert.ok(!covered([]));

  // No include and no files means **/*, so the default config covers everything.
  const {dir, outPath} = makeProject({config: {compilerOptions: {allowJs: true, jsx: 'react-jsx'}}});
  assert.equal(planConfigFix({cwd: dir, outPath}).action, 'none');
});

test('an exclude that hides the sources is reported, not rewritten', () => {
  const {dir, outPath} = makeProject({
    config: {compilerOptions: {allowJs: true, jsx: 'react-jsx'}, include: ['frontend'], exclude: ['frontend']},
  });
  const plan = planConfigFix({cwd: dir, outPath});
  assert.deepEqual(plan.next.exclude, ['frontend']);
  assert.match(plan.notes.join(), /exclude/);
});

test('allowJs is added for JS sources, but never to a jsconfig.json (it implies it)', () => {
  const ts = makeProject({config: {compilerOptions: {jsx: 'react-jsx'}, include: ['frontend']}});
  assert.deepEqual(options(planConfigFix({cwd: ts.dir, outPath: ts.outPath})), {allowJs: true});

  const js = makeProject({
    config: {compilerOptions: {jsx: 'react-jsx'}, include: ['frontend']},
    configName: 'jsconfig.json',
  });
  assert.equal(planConfigFix({cwd: js.dir, outPath: js.outPath}).action, 'none');
});

test('jsx is planned for JSX in plain .js files, as block init writes it', () => {
  const {dir, outPath} = makeProject({
    config: {compilerOptions: {allowJs: true}, include: ['frontend']},
    files: {'frontend/index.js': 'export {};\n'},
  });
  const plan = planConfigFix({cwd: dir, outPath});
  assert.deepEqual(options(plan), {jsx: 'react-jsx'});
  assert.match(plan.changes[0].reason, /\.js files/);

  // Pure TypeScript with no JSX needs nothing.
  const ts = makeProject({config: {include: ['frontend']}, files: {'frontend/index.ts': 'export {};\n'}});
  assert.equal(planConfigFix({cwd: ts.dir, outPath: ts.outPath}).action, 'none');
});

test('a "lib" without DOM gets it; one with it (any casing) is left alone', () => {
  const {dir, outPath} = makeProject({
    config: {compilerOptions: {allowJs: true, jsx: 'react-jsx', lib: ['ES2022']}, include: ['frontend']},
  });
  assert.deepEqual(options(planConfigFix({cwd: dir, outPath})), {lib: ['ES2022', 'DOM']});

  const withDom = makeProject({
    config: {compilerOptions: {allowJs: true, jsx: 'react-jsx', lib: ['es2022', 'dom']}, include: ['frontend']},
  });
  assert.equal(planConfigFix({cwd: withDom.dir, outPath: withDom.outPath}).action, 'none');
});

test('TypeScript 6+ checks side-effect imports, so a stylesheet beside the sources turns that off', () => {
  const project = version =>
    makeProject({
      config: {compilerOptions: {allowJs: true, jsx: 'react-jsx'}, include: ['frontend']},
      files: {
        'frontend/App.jsx': 'export {};\n',
        'frontend/style.css': 'body {}\n',
        'node_modules/typescript/package.json': JSON.stringify({name: 'typescript', version}),
      },
    });
  const ts7 = project('7.0.2');
  const plan = planConfigFix({cwd: ts7.dir, outPath: ts7.outPath});
  assert.deepEqual(options(plan), {noUncheckedSideEffectImports: false});
  assert.match(plan.changes[0].reason, /TypeScript 7/);

  // TS 5 doesn't check them, and 5.5 and older don't know the option at all.
  const ts5 = project('5.9.3');
  assert.equal(planConfigFix({cwd: ts5.dir, outPath: ts5.outPath}).action, 'none');

  // No stylesheet or image to import: nothing to turn off.
  const noAssets = makeProject({
    config: {compilerOptions: {allowJs: true, jsx: 'react-jsx'}, include: ['frontend']},
    files: {'node_modules/typescript/package.json': JSON.stringify({name: 'typescript', version: '7.0.2'})},
  });
  assert.equal(planConfigFix({cwd: noAssets.dir, outPath: noAssets.outPath}).action, 'none');

  // The config airgen creates carries the key only when the compiler needs it.
  const fresh = makeProject({files: {'node_modules/typescript/package.json': JSON.stringify({version: '7.0.2'})}});
  const created = planConfigFix({cwd: fresh.dir, outPath: fresh.outPath});
  assert.equal(created.action, 'create');
  assert.equal(created.next.compilerOptions.noUncheckedSideEffectImports, false);
  assert.deepEqual(created.next, recommendedConfig('frontend', {typescriptMajor: 7}));
  assert.equal('noUncheckedSideEffectImports' in recommendedConfig('frontend').compilerOptions, false);
});

test('module: NodeNext alone (no moduleResolution) implies node resolution too', () => {
  const {dir, outPath} = makeProject({
    config: {compilerOptions: {module: 'nodenext', allowJs: true, jsx: 'preserve'}, include: ['frontend']},
  });
  assert.deepEqual(options(planConfigFix({cwd: dir, outPath})), {moduleResolution: 'Bundler'});
});

test('a config with comments is backed up before it is rewritten', () => {
  const original = '{\n  // keep me\n  "include": ["src"],\n}\n';
  const {dir, outPath} = makeProject({config: original});
  const result = applyConfigFix(planConfigFix({cwd: dir, outPath}));
  assert.equal(result.action, 'updated');
  assert.equal(result.backupPath, path.join(dir, 'tsconfig.json.bak'));
  assert.equal(fs.readFileSync(result.backupPath, 'utf8'), original);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8')).include, ['src', 'frontend']);
});

test('plain JSON is rewritten without a backup', () => {
  const {dir, outPath} = makeProject({config: {include: ['src']}});
  const result = applyConfigFix(planConfigFix({cwd: dir, outPath}));
  assert.equal(result.backupPath, null);
  assert.ok(!fs.existsSync(path.join(dir, 'tsconfig.json.bak')));
});

test('an unparseable config is left alone', () => {
  const {dir, outPath} = makeProject({config: '{"include": '});
  const plan = planConfigFix({cwd: dir, outPath});
  assert.equal(plan.action, 'none');
  assert.ok(plan.parseError);
  assert.equal(applyConfigFix(plan).action, 'unchanged');
  assert.equal(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'), '{"include": ');
});

test('fixCommand spells out -o only for a non-default output', () => {
  assert.equal(fixCommand('/p', '/p/frontend/airtable-schema.ts'), 'npx airgen fix-tsconfig');
  assert.equal(fixCommand('/p', '/p/src/schema.ts'), 'npx airgen fix-tsconfig -o src/schema.ts');
  assert.equal(fixCommand('/p', '/p/my src/schema.ts'), 'npx airgen fix-tsconfig -o "my src/schema.ts"');
});

test('the stub carries the generated header and an empty current-version meta', () => {
  assert.ok(STUB_SOURCE.startsWith(GENERATED_HEADER));
  assert.match(STUB_SOURCE, new RegExp(`"version": ${META_VERSION},`));
  assert.ok(!/^import /m.test(STUB_SOURCE), 'the stub must not pick an SDK flavor');
  assert.ok(isStub(STUB_SOURCE));
  assert.ok(!isStub(generateTypeScriptFromBase(mockBase)));
});

test('writeStubIfMissing never overwrites', () => {
  const {outPath} = makeProject();
  assert.equal(writeStubIfMissing(outPath), true);
  assert.equal(fs.readFileSync(outPath, 'utf8'), STUB_SOURCE);
  fs.writeFileSync(outPath, 'mine');
  assert.equal(writeStubIfMissing(outPath), false);
  assert.equal(fs.readFileSync(outPath, 'utf8'), 'mine');
});

test('stub → first real file diffs as pure additions, so --fix offers nothing', () => {
  const diff = diffGeneratedFiles(STUB_SOURCE, generateTypeScriptFromBase(mockBase));
  assert.equal(diff.ok, true);
  assert.deepEqual(diff.changes, []);
});
