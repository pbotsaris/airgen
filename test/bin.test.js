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

function launch(args, env) {
  const child = spawn(process.execPath, [BIN, ...args], {
    env: {...process.env, ...env},
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
  return {child, exited, daemonPort, stderr: () => stderr};
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
