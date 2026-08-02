/**
 * Consumer-project typechecker for the airgen daemon.
 *
 * Spawns the CONSUMER'S OWN `tsc` (resolved from their node_modules at check
 * time — airgen ships no typescript) as a child process, so a slow check never
 * blocks the daemon's event loop, `--pretty false` output stays parseable
 * across TS 4.x–5.x, and the program's memory returns to the OS on exit.
 * Checks are coalesced: one in flight, at most one queued behind it.
 *
 * Threat-model care (the daemon's CORS is deliberately permissive): reported
 * file paths are cwd-relative and messages have the absolute cwd scrubbed, so
 * a webpage reading /diagnostics learns no absolute paths or usernames.
 */

import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const MAX_ERRORS = 50;
const CHECK_TIMEOUT_MS = 120_000;

// `path/to/file.ts(12,5): error TS2322: message`
const FILE_ERROR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
// Config-level errors have no file position: `error TS5083: message`
const GLOBAL_ERROR_RE = /^error (TS\d+): (.*)$/;

/** Nearest tsconfig.json at or above startDir, or null. A manual walk-up — no
 * point loading the multi-MB typescript module just to find a path. */
export function findTsconfig(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Root of the consumer's own `typescript` package, or null when it isn't
 * installed. Resolved per call so installing typescript mid-session heals
 * without a restart — airgen never ships a copy of its own.
 */
export function resolveTypescriptDir(cwd) {
  try {
    const requireFromProject = createRequire(path.join(cwd, 'noop.js'));
    return path.dirname(requireFromProject.resolve('typescript/package.json'));
  } catch {
    return null;
  }
}

/** Path to the consumer's tsc.js, or null when typescript isn't installed. */
function resolveTsc(cwd) {
  const dir = resolveTypescriptDir(cwd);
  return dir === null ? null : path.join(dir, 'lib', 'tsc.js');
}

/**
 * @param {{cwd: string, startDir: string, log: (msg: string) => void}} options
 *   startDir is where the tsconfig walk-up begins (the output file's dir).
 */
export function createTypechecker({cwd, startDir, log}) {
  /** Latest settled (or in-progress) diagnostics — what GET /diagnostics serves. */
  let diagnostics = {status: 'checking', errors: [], total: 0, checkedAt: null};
  let checking = false;
  let rerunQueued = false;
  let activeChild = null;
  let disposed = false;

  function scrub(text) {
    return text.split(cwd + path.sep).join('').split(cwd).join('.');
  }

  function relativize(file, baseDir) {
    const relative = path.relative(cwd, path.resolve(baseDir, file));
    return relative === '' ? '.' : relative;
  }

  function unavailable(reason) {
    return {status: 'unavailable', errors: [], total: 0, checkedAt: new Date().toISOString(), reason};
  }

  function settled(errors) {
    return {
      status: errors.length === 0 ? 'ok' : 'errors',
      errors: errors.slice(0, MAX_ERRORS),
      total: errors.length,
      checkedAt: new Date().toISOString(),
    };
  }

  function parseOutput(output, baseDir) {
    const errors = [];
    for (const line of output.split(/\r?\n/)) {
      let match = FILE_ERROR_RE.exec(line);
      if (match) {
        errors.push({
          file: relativize(match[1], baseDir),
          line: Number(match[2]),
          col: Number(match[3]),
          code: match[4],
          message: scrub(match[5]),
        });
        continue;
      }
      match = GLOBAL_ERROR_RE.exec(line);
      if (match) {
        errors.push({file: 'tsconfig.json', line: 1, col: 1, code: match[1], message: scrub(match[2])});
      }
    }
    return errors;
  }

  function runOnce() {
    return new Promise(resolve => {
      const tsconfigPath = findTsconfig(startDir);
      if (!tsconfigPath) {
        resolve(unavailable('no tsconfig.json found at or above the output directory'));
        return;
      }
      const tscJs = resolveTsc(cwd);
      if (!tscJs) {
        resolve(unavailable('typescript not found in project node_modules'));
        return;
      }

      const tsconfigDir = path.dirname(tsconfigPath);
      const child = spawn(process.execPath, [tscJs, '--noEmit', '-p', tsconfigPath, '--pretty', 'false'], {
        cwd: tsconfigDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      activeChild = child;

      let stdout = '';
      let timedOut = false;
      let done = false;
      child.stdout.on('data', chunk => (stdout += chunk));
      child.stderr.on('data', () => {});
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, CHECK_TIMEOUT_MS);

      const finish = result => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        activeChild = null;
        resolve(result);
      };

      child.on('error', error => {
        finish(settled([{file: 'tsconfig.json', line: 1, col: 1, code: 'AIRGEN', message: `failed to run tsc: ${scrub(error.message)}`}]));
      });
      child.on('close', exitCode => {
        if (timedOut) {
          finish(settled([{file: 'tsconfig.json', line: 1, col: 1, code: 'AIRGEN', message: `typecheck timed out after ${CHECK_TIMEOUT_MS / 1000}s`}]));
          return;
        }
        const errors = parseOutput(stdout, tsconfigDir);
        if (errors.length === 0 && exitCode !== 0 && exitCode !== null) {
          // Never report a failed check as clean.
          finish(settled([{file: 'tsconfig.json', line: 1, col: 1, code: 'AIRGEN', message: `tsc exited with code ${exitCode} and no parseable errors`}]));
          return;
        }
        finish(settled(errors));
      });
    });
  }

  function schedule() {
    if (disposed) return;
    if (checking) {
      rerunQueued = true;
      return;
    }
    checking = true;
    diagnostics = {...diagnostics, status: 'checking'};
    runOnce().then(result => {
      diagnostics = result;
      if (result.status === 'unavailable') {
        log(`Typecheck unavailable (${result.reason})`);
      } else {
        log(`Typecheck: ${result.status === 'ok' ? 'ok' : `${result.total} error${result.total === 1 ? '' : 's'}`}`);
      }
      checking = false;
      if (rerunQueued && !disposed) {
        rerunQueued = false;
        schedule();
      }
    });
  }

  return {
    schedule,
    /** Current diagnostics snapshot — a pure read, never triggers a check. */
    get current() {
      return diagnostics;
    },
    /** Kills any in-flight check; used when the daemon shuts down. */
    dispose() {
      disposed = true;
      rerunQueued = false;
      if (activeChild) activeChild.kill('SIGKILL');
    },
  };
}
