import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distClient = path.join(projectRoot, 'dist', 'client');

function readDist(name) {
  return fs.readFileSync(path.join(distClient, name), 'utf8');
}

function sdkImports(source) {
  return [...source.matchAll(/from\s+['"](@airtable\/blocks[^'"]*)['"]/g)].map(m => m[1]);
}

// Each entry binds exactly one SDK flavor; a stray import of another flavor's
// path would break bundling for every consumer of that entry (the experimental
// SDK's exports map has no "./ui", the stable SDK has no "./interface/ui").
test('each entry point imports only its own SDK ui module', () => {
  assert.deepEqual(sdkImports(readDist('index.js')), ['@airtable/blocks/ui']);
  assert.deepEqual(sdkImports(readDist('interface.js')), ['@airtable/blocks/interface/ui']);
  assert.deepEqual(sdkImports(readDist('base.js')), ['@airtable/blocks/base/ui']);
});

test('core modules import no SDK paths (structural-types invariant)', () => {
  for (const name of ['generator.js', 'schema-signature.js', 'schema-drift.js', 'SchemaObserver.js', 'useTypedRecords.js', 'sdk.js']) {
    assert.deepEqual(sdkImports(readDist(name)), [], `${name} should not import @airtable/blocks`);
  }
});

test('entry declaration files leak no SDK type imports', () => {
  for (const name of ['index.d.ts', 'interface.d.ts', 'base.d.ts']) {
    assert.deepEqual(sdkImports(readDist(name)), [], `${name} should not reference @airtable/blocks`);
  }
});

test('package exports map matches the built entries', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  for (const key of ['.', './interface', './base']) {
    const entry = pkg.exports[key];
    for (const target of [entry.types, entry.default]) {
      assert.ok(fs.existsSync(path.join(projectRoot, target)), `${key} → ${target} missing`);
    }
  }
});
