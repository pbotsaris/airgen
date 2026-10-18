/**
 * The install notice: pure, built from tsc's own messages. The daemon-level
 * counterpart (a real tsc against an untyped package) is in diagnostics.test.js.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {detectPackageManager, installCommand, planInstall} from '../src/daemon/setup-hints.js';

function makeProject(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-setup-test-'));
  test.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), text);
  return dir;
}

// Messages as the typechecker reports them: tsc's continuation lines joined on.
const UNTYPED_REACT = {
  code: 'TS7016',
  message:
    "Could not find a declaration file for module 'react'. 'node_modules/react/index.js' implicitly has an 'any' type. " +
    "Try `npm i --save-dev @types/react` if it exists or add a new declaration (.d.ts) file containing `declare module 'react';`",
};
const UNTYPED_JSX_RUNTIME = {
  code: 'TS7016',
  message:
    "Could not find a declaration file for module 'react/jsx-runtime'. 'node_modules/react/jsx-runtime.js' implicitly has an 'any' type. " +
    "Try `npm i --save-dev @types/react` if it exists or add a new declaration (.d.ts) file containing `declare module 'react/jsx-runtime';`",
};
const NODE_GLOBAL = {
  code: 'TS2580',
  message:
    "Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node`.",
};
const MISSING_TYPES_ENTRY = {code: 'TS2688', message: "Cannot find type definition file for 'jest'."};
const UNRELATED = {code: 'TS2322', message: "Type 'string' is not assignable to type 'number'."};
const JSX_ANY = {
  code: 'TS7026',
  message: "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.",
};

test('packages come from tsc hints, once each, with what needs them', () => {
  const cwd = makeProject();
  const plan = planInstall({
    cwd,
    errors: [UNTYPED_REACT, UNTYPED_JSX_RUNTIME, JSX_ANY, NODE_GLOBAL, NODE_GLOBAL, MISSING_TYPES_ENTRY, UNRELATED],
  });
  assert.deepEqual(plan.packages, ['@types/react', '@types/node', '@types/jest']);
  assert.equal(plan.command, 'npm i -D @types/react @types/node @types/jest');
  assert.deepEqual(plan.issues, [
    "@types/react: no type declarations for 'react', 'react/jsx-runtime'",
    "@types/node: Cannot find name 'process'",
    `@types/jest: "types" lists 'jest'`,
  ]);
});

test('errors that name no package yield no notice', () => {
  const cwd = makeProject();
  assert.equal(planInstall({cwd, errors: [UNRELATED, JSX_ANY]}), undefined);
  assert.equal(planInstall({cwd, errors: []}), undefined);
});

test('a missing typescript is a notice of its own, listed first', () => {
  const cwd = makeProject();
  const plan = planInstall({cwd, errors: [], typescriptMissing: true});
  assert.deepEqual(plan.packages, ['typescript']);
  assert.equal(plan.command, 'npm i -D typescript');
  assert.match(plan.issues[0], /^typescript: /);
});

test('the package manager follows the packageManager field, then the lockfile, then npm', () => {
  assert.equal(detectPackageManager(makeProject()), 'npm');
  assert.equal(detectPackageManager(makeProject({'package-lock.json': '{}'})), 'npm');
  assert.equal(detectPackageManager(makeProject({'pnpm-lock.yaml': ''})), 'pnpm');
  assert.equal(detectPackageManager(makeProject({'yarn.lock': ''})), 'yarn');
  assert.equal(detectPackageManager(makeProject({'bun.lock': ''})), 'bun');
  const field = makeProject({'package.json': JSON.stringify({packageManager: 'pnpm@9.1.0'}), 'yarn.lock': ''});
  assert.equal(detectPackageManager(field), 'pnpm');
  assert.equal(installCommand(field, ['@types/react']), 'pnpm add -D @types/react');
  assert.equal(installCommand(makeProject({'bun.lockb': ''}), ['typescript']), 'bun add -d typescript');
  // Not JSON: the lockfile decides.
  assert.equal(detectPackageManager(makeProject({'package.json': '{nope', 'yarn.lock': ''})), 'yarn');
});
