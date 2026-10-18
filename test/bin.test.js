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
    const timer = setTimeout(
      () => reject(new Error(`daemon never started; stdout: ${stdout} stderr: ${stderr}`)),
      5000,
    );
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

test("exits with `block run`'s exit code when it finishes", async () => {
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
  const {child, exited, daemonPort} = launch(['--daemon-only', '-p', '0', '-o', path.join(dir, 'out.ts')], {
    PATH: '/usr/bin:/bin',
  });
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
  const {child, exited, waitFor, stdout} = launch(
    ['--daemon-only', '-p', '0', '-o', 'cli-out.ts'],
    {PATH: '/usr/bin:/bin'},
    dir,
  );
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
  const {child, exited, daemonPort} = launch(['--daemon-only', '-p', '0', '-o', path.join(dir, 'out.ts')], {
    PATH: '/usr/bin:/bin',
  });
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
  const {child, exited, daemonPort} = launch(['--daemon-only', '--fix', '-p', '0', '-o', path.join(dir, 'out.ts')], {
    PATH: '/usr/bin:/bin',
  });
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

/** Runs a one-shot command (no daemon) to completion. */
function runOnce(args, cwd) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [BIN, ...args], {cwd, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('exit', code => resolve({code, stdout, stderr}));
  });
}

test('first run writes a placeholder schema and the recommended tsconfig', async () => {
  const dir = makeTempDir();
  const {child, exited, waitFor, stdout} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    await waitFor(/listening on/);
    const schema = fs.readFileSync(path.join(dir, 'frontend', 'airtable-schema.ts'), 'utf8');
    assert.match(schema, /^\/\/ Generated by airgen/);
    assert.match(schema, /export const airgenMeta/);
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'));
    assert.deepEqual(config.include, ['frontend']);
    assert.match(stdout(), /Created tsconfig\.json/);
    assert.match(stdout(), /placeholder/);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('an existing schema and tsconfig are left alone at startup', async () => {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, 'frontend'));
  fs.writeFileSync(path.join(dir, 'frontend', 'airtable-schema.ts'), '// mine\n');
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{"include": ["src"]}');
  const {child, exited, waitFor, stdout} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    await waitFor(/listening on/);
    assert.equal(fs.readFileSync(path.join(dir, 'frontend', 'airtable-schema.ts'), 'utf8'), '// mine\n');
    assert.equal(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'), '{"include": ["src"]}');
    assert.doesNotMatch(stdout(), /placeholder|Created/);
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});

test('fix-tsconfig rewrites the config for the output path and exits', async () => {
  const dir = makeTempDir();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'App.jsx'), 'export {};\n');
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({compilerOptions: {moduleResolution: 'NodeNext', allowJs: true}, include: ['lib']}),
  );
  const {code, stdout} = await runOnce(['fix-tsconfig', '-o', 'src/schema.ts'], dir);
  assert.equal(code, 0);
  assert.match(stdout, /Updated tsconfig\.json/);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8'));
  assert.deepEqual(config.include, ['lib', 'src']);
  assert.equal(config.compilerOptions.jsx, 'react-jsx');
  assert.equal(config.compilerOptions.moduleResolution, 'Bundler');
  assert.ok(!fs.existsSync(path.join(dir, 'src', 'schema.ts')), 'the command writes no stub');

  const again = await runOnce(['fix-tsconfig', '-o', 'src/schema.ts'], dir);
  assert.equal(again.code, 0);
  assert.match(again.stdout, /nothing to change/);
});

test('an extension nested in another TypeScript project gets its own config', async () => {
  const parent = makeTempDir();
  const parentConfig = JSON.stringify({compilerOptions: {jsx: 'react'}, include: ['src']});
  fs.writeFileSync(path.join(parent, 'tsconfig.json'), parentConfig);
  const dir = path.join(parent, 'extension');
  fs.mkdirSync(path.join(dir, 'frontend'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'block.json'), '{}');
  fs.writeFileSync(path.join(dir, 'frontend', 'broken.ts'), 'export const n: number = "not a number";\n');
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.symlinkSync(
    fileURLToPath(new URL('../node_modules/typescript', import.meta.url)),
    path.join(dir, 'node_modules', 'typescript'),
    'dir',
  );

  const {child, exited, daemonPort, waitFor} = launch(['--daemon-only', '-p', '0'], {PATH: '/usr/bin:/bin'}, dir);
  try {
    await waitFor(/Created tsconfig\.json/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8')).include, ['frontend']);
    assert.equal(fs.readFileSync(path.join(parent, 'tsconfig.json'), 'utf8'), parentConfig);

    // The check runs the extension's config, so it sees the extension's files.
    await waitFor(/Typecheck: /);
    const diagnostics = await (await fetch(`http://127.0.0.1:${await daemonPort}/diagnostics`)).json();
    assert.equal(diagnostics.status, 'errors', JSON.stringify(diagnostics));
    assert.deepEqual(
      diagnostics.errors.map(error => error.file),
      [path.join('frontend', 'broken.ts')],
    );
  } finally {
    child.kill('SIGTERM');
    await exited;
  }
});
