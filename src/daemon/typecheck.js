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

/**
 * Config files a consumer project can be driven by, in preference order. A
 * plain-JS extension has no tsconfig.json, but `jsconfig.json` is the same
 * format — TypeScript reads it with `allowJs` implied — so both features work
 * off either one.
 */
export const PROJECT_CONFIG_NAMES = ['tsconfig.json', 'jsconfig.json'];

/** The names, as they read in a message: `tsconfig.json or jsconfig.json`. */
export const PROJECT_CONFIG_LABEL = PROJECT_CONFIG_NAMES.join(' or ');

/** Nearest project config at or above startDir, or null. A manual walk-up — no
 * point loading the multi-MB typescript module just to find a path. tsconfig
 * wins when a directory has both. */
export function findProjectConfig(startDir) {
  let dir = startDir;
  for (;;) {
    for (const name of PROJECT_CONFIG_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
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

/** Major version of the consumer's `typescript`, or null when it isn't installed. */
export function typescriptMajor(cwd) {
  const dir = resolveTypescriptDir(cwd);
  if (dir === null) return null;
  try {
    const {version} = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return Number.parseInt(version, 10);
  } catch {
    return null;
  }
}

/** Path to the consumer's tsc.js, or null when typescript isn't installed. */
function resolveTsc(cwd) {
  const dir = resolveTypescriptDir(cwd);
  return dir === null ? null : path.join(dir, 'lib', 'tsc.js');
}

const TYPESCRIPT_MISSING = 'typescript not found in project node_modules';

/**
 * @param {{cwd: string, startDir: string, log: (msg: string) => void,
 *   inspectConfig?: () => object | null,
 *   inspectInstall?: (input: {errors: object[], typescriptMissing: boolean}) => object | null}} options
 *   startDir is where the project-config walk-up begins (the output file's dir).
 *   inspectConfig reports what's wrong with the project config (or null); its
 *   result rides along on every snapshot as `config`. inspectInstall reports
 *   the dev dependencies the errors say are missing (or null), served as `install`.
 */
export function createTypechecker({cwd, startDir, log, inspectConfig = () => null, inspectInstall = () => null}) {
  /** Latest settled (or in-progress) diagnostics — what GET /diagnostics serves. */
  let diagnostics = {status: 'checking', errors: [], total: 0, checkedAt: null};
  let checking = false;
  let rerunQueued = false;
  let activeChild = null;
  let disposed = false;
  let watchedConfig = null;

  // A config edit (say, `npx airgen fix-tsconfig`) or an install (`npm i -D
  // @types/react` rewrites package.json) changes the result without any schema
  // write, so those files trigger a recheck themselves. Polling watchFile,
  // unref'd, because fs.watch drops events on editors' atomic saves.
  const onProjectFileChange = (current, previous) => {
    if (current.mtimeMs !== previous.mtimeMs) schedule();
  };
  function watchConfig(configPath) {
    if (configPath === watchedConfig) return;
    if (watchedConfig !== null) fs.unwatchFile(watchedConfig, onProjectFileChange);
    watchedConfig = configPath;
    if (configPath !== null) fs.watchFile(configPath, {interval: 1000}, onProjectFileChange).unref();
  }
  // Watching a file that doesn't exist yet is fine: it fires when it appears.
  const packageJson = path.join(cwd, 'package.json');
  fs.watchFile(packageJson, {interval: 1000}, onProjectFileChange).unref();

  function inspect() {
    try {
      return inspectConfig() ?? undefined;
    } catch {
      return undefined;
    }
  }

  function installFor(errors, typescriptMissing) {
    try {
      return inspectInstall({errors, typescriptMissing}) ?? undefined;
    } catch {
      return undefined;
    }
  }

  function scrub(text) {
    return text
      .split(cwd + path.sep)
      .join('')
      .split(cwd)
      .join('.');
  }

  function relativize(file, baseDir) {
    const relative = path.relative(cwd, path.resolve(baseDir, file));
    return relative === '' ? '.' : relative;
  }

  function unavailable(reason) {
    return {
      status: 'unavailable',
      errors: [],
      total: 0,
      checkedAt: new Date().toISOString(),
      reason,
      config: inspect(),
      install: installFor([], reason === TYPESCRIPT_MISSING),
    };
  }

  function settled(errors) {
    return {
      status: errors.length === 0 ? 'ok' : 'errors',
      errors: errors.slice(0, MAX_ERRORS),
      total: errors.length,
      checkedAt: new Date().toISOString(),
      config: inspect(),
      install: installFor(errors, false),
    };
  }

  function parseOutput(output, baseDir, configName) {
    const errors = [];
    for (const line of output.split(/\r?\n/)) {
      // Indented lines continue the previous message (tsc's related detail,
      // and the `Try \`npm i --save-dev @types/x\`` hint the install notice reads).
      if (/^\s+\S/.test(line) && errors.length > 0) {
        errors[errors.length - 1].message += ` ${scrub(line.trim())}`;
        continue;
      }
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
        errors.push({file: configName, line: 1, col: 1, code: match[1], message: scrub(match[2])});
      }
    }
    return errors;
  }

  function runOnce() {
    return new Promise(resolve => {
      const configPath = findProjectConfig(startDir);
      watchConfig(configPath);
      if (!configPath) {
        resolve(unavailable(`no ${PROJECT_CONFIG_LABEL} found at or above the output directory`));
        return;
      }
      const tscJs = resolveTsc(cwd);
      if (!tscJs) {
        resolve(unavailable(TYPESCRIPT_MISSING));
        return;
      }

      const configDir = path.dirname(configPath);
      const configName = path.basename(configPath);
      // `-p` takes any config path; tsc applies jsconfig's implied options
      // (allowJs, and NOT checkJs) when the file is named jsconfig.json.
      const child = spawn(process.execPath, [tscJs, '--noEmit', '-p', configPath, '--pretty', 'false'], {
        cwd: configDir,
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
        finish(
          settled([
            {file: configName, line: 1, col: 1, code: 'AIRGEN', message: `failed to run tsc: ${scrub(error.message)}`},
          ]),
        );
      });
      child.on('close', exitCode => {
        if (timedOut) {
          finish(
            settled([
              {
                file: configName,
                line: 1,
                col: 1,
                code: 'AIRGEN',
                message: `typecheck timed out after ${CHECK_TIMEOUT_MS / 1000}s`,
              },
            ]),
          );
          return;
        }
        const errors = parseOutput(stdout, configDir, configName);
        if (errors.length === 0 && exitCode !== 0 && exitCode !== null) {
          // Never report a failed check as clean.
          finish(
            settled([
              {
                file: configName,
                line: 1,
                col: 1,
                code: 'AIRGEN',
                message: `tsc exited with code ${exitCode} and no parseable errors`,
              },
            ]),
          );
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
      // The install happens in this terminal, so the command is printed here too.
      const install = result.install ? ` · missing dev dependencies, run: ${result.install.command}` : '';
      if (result.status === 'unavailable') {
        log(`Typecheck unavailable (${result.reason})${install}`);
      } else {
        const summary = result.status === 'ok' ? 'ok' : `${result.total} error${result.total === 1 ? '' : 's'}`;
        log(`Typecheck: ${summary}${install}`);
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
      watchConfig(null);
      fs.unwatchFile(packageJson, onProjectFileChange);
      if (activeChild) activeChild.kill('SIGKILL');
    },
  };
}
