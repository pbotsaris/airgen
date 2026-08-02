/**
 * End-to-end assisted fixes: a schema rename lands, the daemon locates the
 * affected code, and applying the fix rewrites it. Slow tier — every case
 * builds a real TypeScript program over a temp consumer project.
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

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: 'es2020',
    module: 'es2020',
    moduleResolution: 'bundler',
    jsx: 'react',
    allowJs: true,
  },
  include: ['src'],
});

const APP_TS = `import {useRecords, type ProjectsRecord} from './airtable-schema';

export function emails(): Array<string | undefined> {
  const projects = useRecords('Projects');
  return projects.map(project => project.fields.contactEmail);
}

export function destructured(): string | undefined {
  const [first] = useRecords('Projects');
  const {contactEmail} = first.fields;
  return contactEmail;
}

export function todoCount(): number {
  return useRecords('Projects').filter(p => p.fields.status?.name === 'Todo').length;
}

// An unrelated string that happens to read 'Todo' — must survive untouched.
export const unrelatedLabel = 'Todo';

export function describe(record: ProjectsRecord): string | undefined {
  return record.contactEmail;
}
`;

const LEGACY_JS = `import {useRecords} from './airtable-schema';

// Plain JS: the generated hooks are usable here too, so renames must reach it.
export function firstEmail() {
  const rows = useRecords('Projects');
  return rows[0] && rows[0].fields.contactEmail;
}
`;

/** A temp consumer project with airgen + typescript resolvable, like a real one. */
function makeProject({fix = true, app = APP_TS, legacy = LEGACY_JS} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-codemod-test-'));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), app);
  fs.writeFileSync(path.join(dir, 'src', 'legacy.js'), legacy);
  fs.writeFileSync(path.join(dir, 'src', 'airtable-schema.ts'), generateTypeScriptFromBase(mockBase));

  linkIntoNodeModules(dir, {
    airgen: projectRoot,
    typescript: path.join(projectRoot, 'node_modules', 'typescript'),
    '@airtable': path.join(projectRoot, 'node_modules', '@airtable'),
    '@types': path.join(projectRoot, 'node_modules', '@types'),
    react: path.join(projectRoot, 'node_modules', 'react'),
  });

  return {dir, fix};
}

async function withProject(setup, run) {
  const {dir, fix} = makeProject(setup);
  const logs = [];
  const server = await startDaemon({
    port: 0,
    outPath: path.join('src', 'airtable-schema.ts'),
    cwd: dir,
    fix,
    log: message => logs.push(message),
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({url, dir, logs, read: file => fs.readFileSync(path.join(dir, 'src', file), 'utf8')});
  } finally {
    server.close();
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

/** Regenerates the schema after mutating a clone of the fixture base. */
function regenerate(mutate) {
  const base = structuredClone(mockBase);
  mutate(base);
  return generateTypeScriptFromBase(base);
}

function postSchema(url, code) {
  return fetch(`${url}/save-schema`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({code}),
  });
}

/**
 * The daemon sets its status synchronously while handling the POST, so
 * anything other than 'analyzing' means this round has settled.
 */
async function waitForFixes(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await fetch(`${url}/fixes`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    if (payload.status !== 'analyzing') return payload;
    if (Date.now() > deadline) throw new Error(`timed out; last: ${JSON.stringify(payload)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function applyFix(url, body) {
  return fetch(`${url}/apply-fix`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(typeof body === 'string' ? {id: body} : body),
  });
}

const renameContactEmail = base => {
  base.tables[0].fields.find(field => field.id === 'fldEmail000000001').name = 'Customer Email';
};

test('a renamed field is located across .ts and .js and rewritten on apply', async () => {
  await withProject({}, async ({url, read}) => {
    await postSchema(url, regenerate(renameContactEmail));
    const payload = await waitForFixes(url);

    assert.equal(payload.status, 'ready', payload.reason);
    assert.equal(payload.fixes.length, 1);

    const [fix] = payload.fixes;
    assert.equal(fix.kind, 'field-key-renamed');
    assert.equal(fix.fixable, true);
    assert.deepEqual([fix.from, fix.to], ['contactEmail', 'customerEmail']);
    assert.deepEqual(fix.files, [path.join('src', 'app.ts'), path.join('src', 'legacy.js')]);
    assert.ok(!fix.files.some(file => path.isAbsolute(file)), 'paths must be project-relative');

    const response = await applyFix(url, fix.id);
    assert.equal(response.status, 200);

    const app = read('app.ts');
    assert.match(app, /project\.fields\.customerEmail/);
    assert.match(app, /return record\.customerEmail/);
    assert.doesNotMatch(app, /\.contactEmail\b/); // no property access left behind
    // Shorthand destructuring renames the property and pins the local binding,
    // so `contactEmail` keeps working as a variable — that's the correct edit.
    assert.match(app, /const \{customerEmail: contactEmail\} = first\.fields/);

    assert.match(read('legacy.js'), /rows\[0\]\.fields\.customerEmail/);
  });
});

test('a renamed table rewrites the key literal and the record interface', async () => {
  const app = `import {useRecords, type ProjectsRecord} from './airtable-schema';

export function count(): number {
  return useRecords('Projects').length;
}

export function first(records: ProjectsRecord[]): ProjectsRecord | undefined {
  return records[0];
}

// A same-shaped literal that is not a table key.
export const note = 'Projects';
`;

  await withProject({app, legacy: '// no hooks here\nexport const nothing = 1;\n'}, async ({url, read}) => {
    await postSchema(url, regenerate(base => {
      base.tables[0].name = 'Projekte';
    }));
    const payload = await waitForFixes(url);
    assert.equal(payload.status, 'ready', payload.reason);
    // A table rename fans out into several symbols over the same file, so the
    // whole set has to land in one pass to stay offset-consistent.
    assert.ok(payload.fixes.filter(fix => fix.fixable).length > 1);

    const response = await applyFix(url, {all: true});
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.equal((await response.json()).invalidated, 0);

    const updated = read('app.ts');
    assert.match(updated, /useRecords\('Projekte'\)/);
    assert.match(updated, /records: ProjekteRecord\[\]/);
    assert.match(updated, /import \{useRecords, type ProjekteRecord\}/);
    // Not a table key, so it must be left alone.
    assert.match(updated, /export const note = 'Projects';/);
  });
});

test('a renamed choice rewrites only literals compared against that field', async () => {
  await withProject({}, async ({url, read}) => {
    await postSchema(url, regenerate(base => {
      base.tables[0].fields
        .find(field => field.id === 'fldStatus00000001')
        .options.choices.find(choice => choice.id === 'selTodo000000001').name = 'Backlog';
    }));
    const payload = await waitForFixes(url);
    assert.equal(payload.status, 'ready', payload.reason);

    const fix = payload.fixes.find(candidate => candidate.kind === 'choice-name-renamed');
    assert.ok(fix, `no choice rename in ${JSON.stringify(payload.fixes)}`);
    assert.equal(fix.fixable, true);

    assert.equal((await applyFix(url, fix.id)).status, 200);

    const app = read('app.ts');
    assert.match(app, /\.name === 'Backlog'/);
    // The bare string constant is not a choice comparison — untouched.
    assert.match(app, /export const unrelatedLabel = 'Todo';/);
  });
});

test('deletions are listed with their usages but offer no fix', async () => {
  await withProject({}, async ({url}) => {
    await postSchema(url, regenerate(base => {
      base.tables[0].fields = base.tables[0].fields.filter(field => field.id !== 'fldEmail000000001');
    }));
    const payload = await waitForFixes(url);
    assert.equal(payload.status, 'ready', payload.reason);

    const fix = payload.fixes.find(candidate => candidate.kind === 'field-removed');
    assert.ok(fix, `no removal reported in ${JSON.stringify(payload.fixes)}`);
    assert.equal(fix.fixable, false);
    assert.ok(fix.usages.length > 0, 'a deleted field should still point at its usages');
    assert.ok(fix.usages.every(usage => !path.isAbsolute(usage.file)));
    assert.ok(fix.usages.every(usage => Number.isInteger(usage.line) && usage.line > 0));

    const response = await applyFix(url, fix.id);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /no mechanical fix/);
  });
});

test('a fix is single-use', async () => {
  await withProject({}, async ({url}) => {
    await postSchema(url, regenerate(renameContactEmail));
    const [fix] = (await waitForFixes(url)).fixes;

    assert.equal((await applyFix(url, fix.id)).status, 200);
    // Consumed: the same id must not apply twice.
    assert.equal((await applyFix(url, fix.id)).status, 404);
    assert.equal((await applyFix(url, 'not-a-real-id')).status, 404);
  });
});

test('an edit made after the analysis blocks the apply instead of corrupting it', async () => {
  await withProject({}, async ({url, dir}) => {
    await postSchema(url, regenerate(renameContactEmail));
    const [fix] = (await waitForFixes(url)).fixes;

    const target = path.join(dir, 'src', 'app.ts');
    fs.writeFileSync(target, `// touched by the developer\n${fs.readFileSync(target, 'utf8')}`);

    const response = await applyFix(url, fix.id);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /changed since the analysis/);
    // The file is left exactly as the developer wrote it.
    assert.match(fs.readFileSync(target, 'utf8'), /^\/\/ touched by the developer/);
  });
});

test('applying one fix drops siblings whose offsets it invalidated', async () => {
  await withProject({}, async ({url}) => {
    await postSchema(url, regenerate(base => {
      base.tables[0].name = 'Projekte';
    }));
    const payload = await waitForFixes(url);
    const fixable = payload.fixes.filter(fix => fix.fixable);
    assert.ok(fixable.length > 1);

    const response = await applyFix(url, fixable[0].id);
    assert.equal(response.status, 200);
    // Rather than apply stale offsets, the rest are dropped pending re-analysis.
    const {invalidated} = await response.json();
    assert.ok(invalidated > 0);

    const after = await waitForFixes(url);
    assert.equal(after.fixes.length, payload.fixes.length - 1 - invalidated);
  });
});

test('without --fix the endpoints do not exist', async () => {
  await withProject({fix: false}, async ({url}) => {
    await postSchema(url, regenerate(renameContactEmail));

    const fixes = await fetch(`${url}/fixes`);
    assert.equal(fixes.status, 404);
    assert.match((await fixes.json()).error, /--fix/);

    const apply = await applyFix(url, 'anything');
    assert.equal(apply.status, 404);
  });
});

test('a purely additive schema change produces no fixes', async () => {
  await withProject({}, async ({url}) => {
    await postSchema(url, regenerate(base => {
      base.tables[0].fields.push({id: 'fldNew0000000001', name: 'Brand New', type: 'singleLineText'});
    }));

    const payload = await waitForFixes(url);
    assert.equal(payload.status, 'idle');
    assert.deepEqual(payload.fixes, []);
  });
});
