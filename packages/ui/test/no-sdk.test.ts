import {expect, test} from 'vitest';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Mirrors airgen's entries.test.js invariant: SDK module imports live only in
// per-flavor entry points (none of which exist yet). A stray
// `@airtable/blocks/interface/ui` import here would break bundling for every
// other flavor's consumers. Comments may mention the SDK; imports may not.
const SDK_IMPORT = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]@airtable\/blocks/;

test('no src module imports @airtable/blocks', () => {
  const offenders = walk(SRC).filter(file => SDK_IMPORT.test(readFileSync(file, 'utf8')));
  expect(offenders).toEqual([]);
});
