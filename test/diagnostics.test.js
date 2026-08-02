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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = generateTypeScriptFromBase(mockBase);

const TSCONFIG = JSON.stringify({
  compilerOptions: {strict: true, noEmit: true, skipLibCheck: true},
  include: ['src'],
});

/**
 * A temp consumer project the daemon runs in: tsconfig + src/index.ts (with a
 * deliberate type error unless `valid`), typescript symlinked from this
 * repo's devDependency unless `withTypescript: false`. The daemon's outPath
 * sits at the project root, OUTSIDE tsconfig's include, so the generated
 * file's `import 'airgen'` never enters the checked program.
 */
async function withProject({withTypescript = true, valid = false} = {}, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-diag-test-'));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'index.ts'), sourceFile(valid));
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
  await withProject({withTypescript: false}, async ({url}) => {
    const payload = await waitForDiagnostics(url, p => p.status !== 'checking');
    assert.equal(payload.status, 'unavailable');
    assert.match(payload.reason, /typescript/i);
    assert.deepEqual(payload.errors, []);
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
