/**
 * Daemon typecheck + GET /diagnostics. Kept out of daemon.test.js because
 * these tests spawn real tsc child processes (the repo's own typescript
 * devDependency, symlinked into a temp consumer project).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {startDaemon} from '../src/daemon/server.js';
import {generateTypeScriptFromBase} from '../dist/client/generator.js';
import {mockBase} from './fixtures/mock-base.js';
import {linkIntoNodeModules} from './helpers.js';
import {STUB_SOURCE} from '../src/daemon/stub.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = generateTypeScriptFromBase(mockBase);

const TSCONFIG = JSON.stringify({
  compilerOptions: {strict: true, noEmit: true, skipLibCheck: true},
  include: ['src'],
});

/** A JS project: `checkJs` is what makes tsc report on `.js` at all. */
const JSCONFIG = JSON.stringify({
  compilerOptions: {checkJs: true, strict: true},
  include: ['src'],
});

/**
 * A temp consumer project the daemon runs in: a config file + a source file
 * (with a deliberate type error unless `valid`), typescript symlinked from
 * this repo's devDependency unless `withTypescript: false`. The daemon's
 * outPath sits at the project root, OUTSIDE the config's include, so the
 * generated file's `import 'airgen'` never enters the checked program.
 */
async function withProject(
  {
    withTypescript = true,
    valid = false,
    config = TSCONFIG,
    configName = 'tsconfig.json',
    sourceName = 'index.ts',
    source = null,
    extraFiles = {},
  } = {},
  run,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-diag-test-'));
  fs.writeFileSync(path.join(dir, configName), config);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', sourceName), source ?? sourceFile(valid));
  for (const [name, text] of Object.entries(extraFiles)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), {recursive: true});
    fs.writeFileSync(path.join(dir, name), text);
  }
  if (withTypescript) {
    linkIntoNodeModules(dir, {typescript: path.join(projectRoot, 'node_modules', 'typescript')});
  }

  const logs = [];
  const server = await startDaemon({
    port: 0,
    outPath: path.join(dir, 'airtable-schema.ts'),
    cwd: dir,
    log: message => logs.push(message),
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({url, dir, logs});
  } finally {
    server.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

function sourceFile(valid) {
  return valid ? 'const x: number = 1;\nexport {x};\n' : "const x: number = 'nope';\nexport {x};\n";
}

async function waitForDiagnostics(url, predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(`${url}/diagnostics`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    if (predicate(payload)) return payload;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for diagnostics; last: ${JSON.stringify(payload)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function postSchema(url, body) {
  return fetch(`${url}/save-schema`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

test('GET /diagnostics serves JSON with CORS headers', async () => {
  await withProject({withTypescript: false}, async ({url}) => {
    const response = await fetch(`${url}/diagnostics`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const payload = await response.json();
    assert.ok(['checking', 'ok', 'errors', 'unavailable'].includes(payload.status));
  });
});

test('typescript missing from the project settles as unavailable', async () => {
  await withProject({withTypescript: false}, async ({url, logs}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'unavailable');
    assert.match(payload.reason, /typescript/i);
    assert.deepEqual(payload.errors, []);
    // The one thing to install before the panel can do anything.
    assert.deepEqual(payload.install.packages, ['typescript']);
    assert.equal(payload.install.command, 'npm i -D typescript');
    assert.ok(
      logs.some(line => line.includes('npm i -D typescript')),
      logs.join('\n'),
    );
  });
});

test('an untyped dependency comes with the install command, and installing it rechecks', async () => {
  // A `react` with no types, as a fresh blocks scaffold has it; the lockfile
  // picks the package manager the command is spelled for.
  const extraFiles = {
    'pnpm-lock.yaml': '',
    'package.json': JSON.stringify({name: 'consumer', dependencies: {react: '*'}}),
    'node_modules/react/package.json': JSON.stringify({name: 'react', version: '19.0.0', main: 'index.js'}),
    'node_modules/react/index.js': "module.exports = {version: '19.0.0'};\n",
  };
  const source = "import React from 'react';\nexport const length: number = React.version.length;\n";
  await withProject({source, extraFiles}, async ({url, dir, logs}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'errors');
    assert.equal(payload.errors[0].code, 'TS7016');
    // tsc's hint is on a continuation line; the message carries it whole.
    assert.match(payload.errors[0].message, /Try `npm i --save-dev @types\/react`/);
    assert.ok(!payload.errors[0].message.includes(dir), 'no absolute paths');
    assert.deepEqual(payload.install, {
      command: 'pnpm add -D @types/react',
      packages: ['@types/react'],
      issues: ["@types/react: no type declarations for 'react'"],
    });
    assert.ok(
      logs.some(line => line.includes('pnpm add -D @types/react')),
      logs.join('\n'),
    );

    // "Installing" the types rewrites package.json, which is what the daemon watches.
    fs.mkdirSync(path.join(dir, 'node_modules', '@types', 'react'), {recursive: true});
    fs.writeFileSync(
      path.join(dir, 'node_modules', '@types', 'react', 'package.json'),
      JSON.stringify({name: '@types/react', version: '19.0.0', types: 'index.d.ts'}),
    );
    fs.writeFileSync(
      path.join(dir, 'node_modules', '@types', 'react', 'index.d.ts'),
      'declare const React: {version: string};\nexport default React;\n',
    );
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({name: 'consumer', dependencies: {react: '*'}, devDependencies: {'@types/react': '*'}}),
    );
    const settled = await waitForDiagnostics(url, p => p.status === 'ok');
    assert.equal(settled.install, undefined);
  });
});

test('startup check reports type errors with cwd-relative paths', async () => {
  await withProject({}, async ({url}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'errors');
    assert.equal(payload.total, 1);
    const [error] = payload.errors;
    assert.equal(error.file, path.join('src', 'index.ts'));
    assert.ok(!error.file.startsWith(path.sep), 'paths must be relative');
    assert.equal(error.line, 1);
    assert.equal(error.code, 'TS2322');
    assert.ok(error.message.length > 0);
    assert.ok(!error.message.includes(os.tmpdir()), 'messages must not leak absolute paths');
    assert.ok(!Number.isNaN(Date.parse(payload.checkedAt)));
  });
});

test('a jsconfig.json project is typechecked too', async () => {
  await withProject(
    {
      config: JSCONFIG,
      configName: 'jsconfig.json',
      sourceName: 'index.js',
      source: '/** @type {number} */\nconst x = "nope";\nexport {x};\n',
    },
    async ({url, logs}) => {
      const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
      assert.equal(payload.status, 'errors', payload.reason);
      assert.equal(payload.errors[0].file, path.join('src', 'index.js'));
      assert.equal(payload.errors[0].code, 'TS2322');
      assert.ok(!logs.some(line => /unavailable/.test(line)), logs.join('\n'));
    },
  );
});

test('a schema write after fixing the source rechecks to ok', async () => {
  await withProject({}, async ({url, dir}) => {
    await waitForDiagnostics(url, p => p.status === 'errors');

    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), sourceFile(true));
    const response = await postSchema(url, {code});
    assert.equal(response.status, 200);

    const payload = await waitForDiagnostics(url, p => p.status === 'ok');
    assert.deepEqual(payload.errors, []);
    assert.equal(payload.total, 0);
  });
});

test('rapid successive writes coalesce and still settle', async () => {
  await withProject({valid: true}, async ({url}) => {
    // Distinct payloads so both actually write (identical content skips).
    await postSchema(url, {code});
    await postSchema(url, {code: `${code}\n// v2\n`});

    const payload = await waitForDiagnostics(url, p => p.status === 'ok');
    assert.equal(payload.status, 'ok');
  });
});

test('a config that matches no inputs comes with the fix-tsconfig command', async () => {
  await withProject({config: JSON.stringify({include: ['nope']}), valid: true}, async ({url, dir}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'errors');
    assert.equal(payload.errors[0].code, 'TS18003');
    assert.equal(payload.config.file, 'tsconfig.json');
    // The output isn't at the default path, so the command names it.
    assert.equal(payload.config.command, 'npx airgen fix-tsconfig -o airtable-schema.ts');
    assert.ok(
      payload.config.issues.some(issue => /"include"/.test(issue)),
      payload.config.issues.join(),
    );
    assert.ok(!JSON.stringify(payload.config).includes(dir), 'no absolute paths');

    // Fixing the config by hand rechecks with no schema write.
    const fixed = {compilerOptions: {strict: true, noEmit: true}, include: ['src', 'airtable-schema.ts']};
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(fixed));
    const settled = await waitForDiagnostics(url, p => p.status === 'ok');
    assert.equal(settled.config, undefined);
  });
});

test('an unparseable config is reported without quoting it', async () => {
  await withProject({config: '{"include": ["secret'}, async ({url}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.config.command, null);
    assert.ok(!JSON.stringify(payload.config).includes('secret'));
  });
});

test('the first-run stub typechecks for a consumer importing airgenMeta', async () => {
  const config = JSON.stringify({
    compilerOptions: {strict: true, noEmit: true},
    include: ['src', 'airtable-schema.ts'],
  });
  const source =
    "import {airgenMeta, type TableKey} from '../airtable-schema';\n" +
    'const count: number = Object.keys(airgenMeta.tables).length;\n' +
    'const version: 2 = airgenMeta.version;\n' +
    'export type Key = TableKey;\n' +
    'export {count, version};\n';
  await withProject({config, source, extraFiles: {'airtable-schema.ts': STUB_SOURCE}}, async ({url}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'ok', JSON.stringify(payload.errors));
    assert.equal(payload.config, undefined);
  });
});
