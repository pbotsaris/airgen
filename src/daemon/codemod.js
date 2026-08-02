/**
 * Daemon side of the assisted-fix flow (opt-in: `npx airgen --fix`).
 *
 * Sequence per schema write: diff the previous generated file against the new
 * one by ID, and when that yields anything, spawn `codemod-worker.js` to locate
 * the affected code. What comes back is held as **pending fixes** the developer
 * can apply from the observer panel.
 *
 * Threat model — this is the one capability that writes outside the fixed
 * output path, so it is deliberately narrow:
 *   - it does not exist unless the developer passed --fix
 *   - `/apply-fix` takes an id and nothing else; edits and paths are never
 *     accepted from the wire, only recomputed here
 *   - every edit must land inside the project root, on an allowlisted
 *     extension, and never on the generated file
 *   - a pending fix is single-use, expires, and is refused if the file changed
 *     since the analysis ran
 */

import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {diffGeneratedFiles} from './schema-diff.js';
import {findProjectConfig, resolveTypescriptDir, PROJECT_CONFIG_LABEL} from './typecheck.js';

const WORKER = fileURLToPath(new URL('./codemod-worker.js', import.meta.url));
const ANALYSIS_TIMEOUT_MS = 120_000;
const FIX_TTL_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

/** Files the codemod may write. Mirrors EDITABLE in codemod-worker.js. */
const EDITABLE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Content hash, so an apply can refuse a file edited since the analysis ran. */
function hashFile(fileName) {
  try {
    return createHash('sha1').update(fs.readFileSync(fileName)).digest('hex');
  } catch {
    return null;
  }
}

/** True when `target` is inside `root` — the boundary every edit must respect. */
function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function runWorker(job) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [WORKER], {stdio: ['pipe', 'pipe', 'pipe']});

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ok: false, reason: `analysis timed out after ${ANALYSIS_TIMEOUT_MS / 1000}s`});
    }, ANALYSIS_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        finish({ok: false, reason: 'analysis produced too much output'});
      }
    });
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('error', error => finish({ok: false, reason: `could not run the analyzer: ${error?.message ?? error}`}));
    child.on('close', () => {
      try {
        finish(JSON.parse(stdout));
      } catch {
        finish({ok: false, reason: stderr.trim().split('\n')[0] || 'analyzer produced no result'});
      }
    });

    child.stdin.end(JSON.stringify(job));
  });
}

/**
 * @param {{cwd: string, outPath: string, log: (msg: string) => void}} options
 */
export function createCodemod({cwd, outPath, log}) {
  /** @type {Map<string, object>} */
  const pending = new Map();
  let status = 'idle';
  let reason = null;
  let running = false;
  let queued = null;

  function expire() {
    const now = Date.now();
    for (const [id, fix] of pending) {
      if (now - fix.createdAt > FIX_TTL_MS) pending.delete(id);
    }
  }

  /** Public view: cwd-relative paths only, no absolute paths, no raw edits. */
  function list() {
    expire();
    return {
      status,
      reason,
      fixes: [...pending.values()].map(fix => ({
        id: fix.id,
        kind: fix.change.kind,
        severity: fix.change.severity,
        fixable: fix.fixable,
        description: fix.change.description,
        from: fix.change.from,
        to: fix.change.to ?? null,
        files: fix.files,
        editCount: fix.edits.length,
        usages: fix.usages,
      })),
    };
  }

  function acceptEdits(edits, projectRoot, generatedFile) {
    const accepted = [];
    for (const edit of edits) {
      const fileName = path.resolve(edit.fileName);
      if (!isInside(projectRoot, fileName)) continue;
      if (path.resolve(generatedFile) === fileName) continue;
      if (!EDITABLE.has(path.extname(fileName))) continue;
      if (!Number.isInteger(edit.start) || !Number.isInteger(edit.length) || typeof edit.newText !== 'string') continue;
      accepted.push({fileName, start: edit.start, length: edit.length, newText: edit.newText});
    }
    return accepted;
  }

  async function analyze(previousSource, nextSource) {
    const generatedFile = path.resolve(cwd, outPath);
    const diff = diffGeneratedFiles(previousSource, nextSource);

    if (!diff.ok) {
      status = 'unavailable';
      reason = diff.reason;
      return;
    }
    if (diff.changes.length === 0) {
      // Purely additive (or cosmetic) — nothing existing code refers to moved.
      pending.clear();
      status = 'idle';
      reason = null;
      return;
    }

    // jsconfig.json counts: a plain-JS extension is exactly the codebase that
    // most needs renames rewritten for it.
    const configPath = findProjectConfig(path.dirname(generatedFile));
    const typescriptDir = resolveTypescriptDir(cwd);

    if (!configPath || !typescriptDir) {
      status = 'unavailable';
      reason = configPath
        ? 'typescript not found in project node_modules'
        : `no ${PROJECT_CONFIG_LABEL} found at or above the output directory`;
      return;
    }

    status = 'analyzing';
    reason = null;

    const changes = diff.changes.map(change => ({...change, id: randomUUID()}));
    const result = await runWorker({
      cwd,
      configPath,
      typescriptDir,
      generatedFile,
      previousSource,
      changes,
    });

    if (!result?.ok) {
      status = 'unavailable';
      reason = result?.reason ?? 'analysis failed';
      return;
    }

    const projectRoot = path.dirname(configPath);
    const byId = new Map(changes.map(change => [change.id, change]));
    pending.clear();

    for (const plan of result.plans ?? []) {
      const change = byId.get(plan.changeId);
      if (!change) continue;

      const edits = acceptEdits(plan.edits ?? [], projectRoot, generatedFile);
      const usages = (plan.usages ?? []).slice(0, 50);

      // Nothing to offer and nothing to point at: the change doesn't touch
      // this codebase, so don't put noise in the panel.
      if (edits.length === 0 && usages.length === 0) continue;

      const files = [...new Set(edits.map(edit => path.relative(cwd, edit.fileName)))].sort();
      const hashes = {};
      for (const edit of edits) hashes[edit.fileName] ??= hashFile(edit.fileName);

      pending.set(change.id, {
        id: change.id,
        change,
        fixable: change.fixable === true && edits.length > 0,
        edits,
        usages,
        files: files.length > 0 ? files : [...new Set(usages.map(usage => usage.file))].sort(),
        hashes,
        createdAt: Date.now(),
      });
    }

    status = 'ready';
    const fixable = [...pending.values()].filter(fix => fix.fixable).length;
    log(`Schema change affects your code: ${pending.size} item${pending.size === 1 ? '' : 's'} (${fixable} fixable)`);
  }

  /** One analysis at a time; a write during one queues the newest pair. */
  function schedule(previousSource, nextSource) {
    if (running) {
      queued = {previousSource, nextSource};
      return;
    }
    running = true;
    analyze(previousSource, nextSource)
      .catch(error => {
        status = 'unavailable';
        reason = `${error?.message ?? error}`;
      })
      .finally(() => {
        running = false;
        if (queued) {
          const next = queued;
          queued = null;
          schedule(next.previousSource, next.nextSource);
        }
      });
  }

  /**
   * Applies a set of pending fixes as one coherent pass.
   *
   * All edits in `pending` were computed against the same snapshot, so they are
   * only consistent with each other — applying one shifts every offset after it.
   * Hence: apply the chosen set together, then DROP any fix left over that
   * touches a file we just rewrote. Dropping forces a fresh analysis on the next
   * save; keeping stale offsets around would corrupt source silently.
   *
   * @returns {{ok: true, files: string[], invalidated: number} | {ok: false, status: number, error: string}}
   */
  function applyFixes(ids) {
    expire();

    const fixes = [];
    for (const id of ids) {
      const fix = typeof id === 'string' ? pending.get(id) : undefined;
      if (!fix) return {ok: false, status: 404, error: 'unknown or expired fix'};
      if (!fix.fixable) return {ok: false, status: 400, error: 'this change has no mechanical fix'};
      fixes.push(fix);
    }
    if (fixes.length === 0) return {ok: false, status: 400, error: 'nothing to apply'};

    for (const fix of fixes) {
      for (const [fileName, hash] of Object.entries(fix.hashes)) {
        if (hashFile(fileName) !== hash) {
          pending.delete(fix.id);
          return {
            ok: false,
            status: 409,
            error: `${path.relative(cwd, fileName)} changed since the analysis — save again to re-analyze`,
          };
        }
      }
    }

    const byFile = new Map();
    for (const fix of fixes) {
      for (const edit of fix.edits) {
        if (!byFile.has(edit.fileName)) byFile.set(edit.fileName, []);
        byFile.get(edit.fileName).push(edit);
      }
    }

    // Two changes should never target the same span; if they somehow do, refuse
    // rather than write an interleaved result.
    for (const [fileName, edits] of byFile) {
      const ordered = [...edits].sort((a, b) => a.start - b.start);
      for (let i = 1; i < ordered.length; i++) {
        if (ordered[i].start < ordered[i - 1].start + ordered[i - 1].length) {
          return {
            ok: false,
            status: 409,
            error: `overlapping edits in ${path.relative(cwd, fileName)} — save again to re-analyze`,
          };
        }
      }
    }

    const written = [];
    for (const [fileName, edits] of byFile) {
      let text = fs.readFileSync(fileName, 'utf8');
      // Last edit first: earlier offsets stay valid as we splice.
      for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.newText + text.slice(edit.start + edit.length);
      }
      fs.writeFileSync(fileName, text, 'utf8');

      const relative = path.relative(cwd, fileName);
      written.push(relative);
      log(`Fixed ${relative} (${edits.length} edit${edits.length === 1 ? '' : 's'})`);
    }

    for (const fix of fixes) pending.delete(fix.id);

    const touched = new Set(byFile.keys());
    let invalidated = 0;
    for (const [id, fix] of pending) {
      if (Object.keys(fix.hashes).some(fileName => touched.has(fileName))) {
        pending.delete(id);
        invalidated++;
      }
    }
    if (invalidated > 0) {
      log(`${invalidated} more fix${invalidated === 1 ? '' : 'es'} need a fresh analysis — save the schema again`);
    }

    return {ok: true, files: written, invalidated};
  }

  /** Applies one fix by id, or every fixable pending fix when `all` is set. */
  function apply({id, all} = {}) {
    if (all === true) {
      return applyFixes([...pending.values()].filter(fix => fix.fixable).map(fix => fix.id));
    }
    return applyFixes([id]);
  }

  return {
    schedule,
    apply,
    list,
    get hasPending() {
      return pending.size > 0;
    },
  };
}
