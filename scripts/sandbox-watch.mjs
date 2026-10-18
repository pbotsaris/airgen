#!/usr/bin/env node
//
// Watch half of `scripts/sandbox.sh --watch` (run that, not this: it does
// the pack + install first, so sandbox/node_modules is complete).
//
//   node scripts/sandbox-watch.mjs [airgen|ui|all]
//
// Runs the packages' compilers in watch mode and copies every file they
// write into the installed copy under sandbox/node_modules. `block run`'s
// esbuild watches node_modules too, so each copy rebuilds and live-reloads
// the extension.
//
// Copying, not symlinking, is the point: esbuild resolves symlinks to their
// real path, so a linked package would pick up the repo root's react and
// stable @airtable/blocks instead of the sandbox's (two Reacts, wrong SDK).

import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SANDBOX_MODULES = path.join(ROOT, 'sandbox', 'node_modules');
const BIN = path.join(ROOT, 'node_modules', '.bin');
const UI_DIR = path.join(ROOT, 'packages', 'ui');

const target = process.argv[2] ?? 'all';
if (!['airgen', 'ui', 'all'].includes(target)) {
  console.error('usage: node scripts/sandbox-watch.mjs [airgen|ui|all]');
  process.exit(1);
}

/** @type {{label: string, cmd: string, args: string[], cwd: string}[]} */
const watchers = [];
/** @type {{label: string, from: string, to: string}[]} */
const syncs = [];

if (target !== 'ui') {
  watchers.push({
    label: 'airgen:tsc',
    cmd: path.join(BIN, 'tsc'),
    args: ['--watch', '--preserveWatchOutput'],
    cwd: ROOT,
  });
  const to = path.join(SANDBOX_MODULES, 'airgen');
  syncs.push({label: 'airgen', from: path.join(ROOT, 'dist'), to: path.join(to, 'dist')});
  // Shipped uncompiled. Copied so the sandbox stays current, but the daemon
  // is a running process: restart `npx airgen` to pick these up.
  syncs.push({
    label: 'airgen',
    from: path.join(ROOT, 'src', 'daemon'),
    to: path.join(to, 'src', 'daemon'),
  });
}

if (target !== 'airgen') {
  watchers.push(
    {
      label: 'ui:tsc',
      cmd: path.join(BIN, 'tsc'),
      args: ['-p', 'tsconfig.json', '--watch', '--preserveWatchOutput'],
      cwd: UI_DIR,
    },
    {
      label: 'ui:css',
      cmd: path.join(BIN, 'tailwindcss'),
      args: ['-c', 'tailwind.config.cjs', '-i', 'src/styles.css', '-o', 'dist/styles.css', '--watch'],
      cwd: UI_DIR,
    },
  );
  syncs.push({
    label: 'ui',
    from: path.join(UI_DIR, 'dist'),
    to: path.join(SANDBOX_MODULES, '@airgen', 'ui', 'dist'),
  });
}

for (const {to} of syncs) {
  if (!fs.existsSync(path.dirname(to))) {
    console.error(`error: ${path.relative(ROOT, path.dirname(to))} is missing — run scripts/sandbox.sh first`);
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

function prefixLines(label, stream, out) {
  let buffered = '';
  stream.on('data', chunk => {
    buffered += chunk;
    const lines = buffered.split('\n');
    buffered = lines.pop();
    // tsc clears the screen with escape codes even under --preserveWatchOutput
    // on some versions; drop blank lines so the prefixed log stays readable.
    for (const line of lines) if (line.trim()) out.write(`[${label}] ${line}\n`);
  });
}

for (const w of watchers) {
  // stdin is inherited: tailwind's --watch exits when stdin closes.
  const child = spawn(w.cmd, w.args, {cwd: w.cwd, stdio: ['inherit', 'pipe', 'pipe']});
  prefixLines(w.label, child.stdout, process.stdout);
  prefixLines(w.label, child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${w.label}] exited (${signal ?? code}) — stopping`);
    shutdown(1);
  });
  children.push(child);
}

// Copy through a temp file + rename so esbuild never reads a half-written
// file. Deletions are mirrored so a removed module doesn't linger.
function syncFile(from, to, rel) {
  const src = path.join(from, rel);
  const dest = path.join(to, rel);
  if (fs.existsSync(src)) {
    if (!fs.statSync(src).isFile()) return false;
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    const tmp = `${dest}.sandbox-tmp`;
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dest);
  } else {
    fs.rmSync(dest, {force: true, recursive: true});
  }
  return true;
}

for (const s of syncs) {
  const pending = new Set();
  let timer = null;
  fs.mkdirSync(s.from, {recursive: true});
  // Debounced: a tsc rebuild writes a burst of files, one log line per burst.
  fs.watch(s.from, {recursive: true}, (_event, rel) => {
    if (!rel) return;
    pending.add(rel);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const files = [...pending];
      pending.clear();
      let copied = 0;
      for (const rel of files) {
        try {
          if (syncFile(s.from, s.to, rel)) copied++;
        } catch (err) {
          console.error(`[sync:${s.label}] ${rel}: ${err.message}`);
        }
      }
      if (copied) console.log(`[sync:${s.label}] ${copied} file(s) -> ${path.relative(ROOT, s.to)}`);
    }, 150);
  });
}

function shutdown(code) {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(
  `==> watching ${target} — Ctrl+C to stop (package.json/dependency changes need a plain scripts/sandbox.sh)`,
);
