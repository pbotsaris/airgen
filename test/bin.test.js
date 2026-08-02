import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BIN = fileURLToPath(new URL('../bin/airgen.js', import.meta.url));

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-bin-test-'));
  test.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

/** Writes a fake `block` executable into dir and returns a PATH that resolves it first. */
function fakeBlockPath(dir, script) {
  const file = path.join(dir, 'block');
  fs.writeFileSync(file, `#!/bin/sh\n${script}\n`);
  fs.chmodSync(file, 0o755);
  return `${dir}:${process.env.PATH}`;
}

function launch(args, env, cwd) {
  const child = spawn(process.execPath, [BIN, ...args], {
    env: {...process.env, ...env},
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => (stdout += chunk));
  child.stderr.on('data', chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.on('exit', code => resolve(code)));
  const daemonPort = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`daemon never started; stdout: ${stdout} stderr: ${stderr}`)), 5000);
    child.stdout.on('data', () => {
      const match = stdout.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on('exit', () => clearTimeout(timer));
  });
  /** Resolves once stdout matches `re`; unlike asserting on stdout after daemonPort, this can't race the log line. */
  const waitFor = re =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`stdout never matched ${re}; stdout: ${stdout} stderr: ${stderr}`));
      }, 5000);
      const check = () => {
        if (re.test(stdout)) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        child.stdout.off('data', check);
      };
      child.stdout.on('data', check);
      check();
    });
  return {child, exited, daemonPort, waitFor, stdout: () => stdout, stderr: () => stderr};
}

test('exits with `block run`\'s exit code when it finishes', async () => {
  const dir = makeTempDir();
  const PATH = fakeBlockPath(dir, 'exit 7');
  const {exited} = launch(['-p', '0', '-o', path.join(dir, 'out.ts')], {PATH});
  assert.equal(await exited, 7);
});

test('daemon serves while `block run` is alive and dies with the process', async () => {
  const dir = makeTempDir();
  const PATH = fakeBlockPath(dir, 'sleep 30');
  const {child, exited, daemonPort} = launch(['-p', '0', '-o', path.join(dir, 'out.ts')], {PATH});
  const port = await daemonPort;

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 204);

  child.kill('SIGTERM');
  assert.equal(await exited, 1);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));
});

test('fails fast with a hint when the block CLI is missing', async () => {
  const dir = makeTempDir();
  const {exited, stderr} = launch(['-p', '0', '-o', path.join(dir, 'out.ts')], {PATH: '/usr/bin:/bin'});
  assert.equal(await exited, 1);
  assert.match(stderr(), /`block` CLI not found/);
  assert.match(stderr(), /--daemon-only/);
});

test('--daemon-only runs the daemon without spawning block', async () => {
  const dir = makeTempDir();
  const {child, exited, daemonPort} = launch(
    ['--daemon-only', '-p', '0', '-o', path.join(dir, 'out.ts')],
    {PATH: '/usr/bin:/bin'}
  );
  const port = await daemonPort;

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 204);

  child.kill('SIGTERM');
  await exited;
});

test('output path defaults to ./frontend/airtable-schema.ts', async () => {
  const dir = makeTempDir();
  const {child, exited, waitFor} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    await waitFor(/Will write schema to .*frontend[\\/]airtable-schema\.ts/);
    assert.ok(fs.existsSync(path.join(dir, 'frontend')));
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('airgen-config.json supplies out and port', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({out: 'custom/schema.ts', port: 0}));
  const {child, exited, daemonPort, waitFor, stdout} = launch(['--daemon-only'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    const port = await daemonPort;
    assert.ok(port > 0); // config port 0 was applied — an ephemeral port, not the 3001 default
    await waitFor(/Will write schema to .*custom[\\/]schema\.ts/);
    assert.match(stdout(), /Applying airgen-config\.json \(port, out\)/);
    assert.ok(fs.existsSync(path.join(dir, 'custom')));
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('CLI flags override airgen-config.json', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({out: 'config-out.ts'}));
  const {child, exited, waitFor, stdout} = launch(['--daemon-only', '-p', '0', '-o', 'cli-out.ts'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    await waitFor(/Will write schema to .*cli-out\.ts/);
    assert.doesNotMatch(stdout(), /config-out\.ts/);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('PORT env var beats the config port', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({port: 65000}));
  const {child, exited, daemonPort} = launch(['--daemon-only'], {PATH: '/usr/bin:/bin', PORT: '0'}, dir);
  try {
    const port = await daemonPort;
    assert.notEqual(port, 65000);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('malformed airgen-config.json fails fast', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), '{oops');
  const {exited, stderr} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  assert.equal(await exited, 1);
  assert.match(stderr(), /Invalid airgen-config\.json/);
});

test('unknown airgen-config.json keys fail fast', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({outDir: 'x'}));
  const {exited, stderr} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  assert.equal(await exited, 1);
  assert.match(stderr(), /Unknown key "outDir" in airgen-config\.json \(known keys: out, port, fix\)/);
});

test('assisted fixes are off unless --fix is passed', async () => {
  const dir = makeTempDir();
  const {child, exited, daemonPort} = launch(
    ['--daemon-only', '-p', '0', '-o', path.join(dir, 'out.ts')],
    {PATH: '/usr/bin:/bin'}
  );
  try {
    const response = await fetch(`http://127.0.0.1:${await daemonPort}/fixes`);
    assert.equal(response.status, 404);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('--fix turns the fix endpoints on', async () => {
  const dir = makeTempDir();
  const {child, exited, daemonPort} = launch(
    ['--daemon-only', '--fix', '-p', '0', '-o', path.join(dir, 'out.ts')],
    {PATH: '/usr/bin:/bin'}
  );
  try {
    const response = await fetch(`http://127.0.0.1:${await daemonPort}/fixes`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).fixes, []);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('airgen-config.json can enable fixes too', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({fix: true, port: 0}));
  const {child, exited, daemonPort, stdout} = launch(['--daemon-only'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    const response = await fetch(`http://127.0.0.1:${await daemonPort}/fixes`);
    assert.equal(response.status, 200);
    assert.match(stdout(), /Applying airgen-config\.json \(port, fix\)/);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('a non-boolean fix key is rejected', async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, 'airgen-config.json'), JSON.stringify({fix: 'yes'}));
  const {exited, stderr} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  assert.equal(await exited, 1);
  assert.match(stderr(), /"fix" must be a boolean/);
});
