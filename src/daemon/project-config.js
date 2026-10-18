/**
 * The consumer's tsconfig/jsconfig: what the daemon's typecheck needs from it,
 * and the `npx airgen fix-tsconfig` command that makes it so.
 *
 * The typecheck runs `tsc -p` on whatever config `findProjectConfig` finds, so
 * a config that doesn't describe the extension makes the panel useless: an
 * `include` that misses the sources (TS18003 "No inputs were found"), JSX with
 * no `jsx` option, `.jsx` files dropped because `allowJs` is off, or NodeNext
 * resolution rejecting the extensionless imports the blocks bundler accepts.
 *
 * Deliberately TypeScript-free: TS 7 ships no JS compiler API, so the config
 * is read as JSONC and checked against the files on disk. It reads the
 * config's own keys only (an `extends` parent isn't followed); a key set here
 * wins over an inherited one either way, so a fix is never wrong, at worst
 * redundant.
 */

import fs from 'node:fs';
import path from 'node:path';

import {findProjectConfig, typescriptMajor} from './typecheck.js';

export const DEFAULT_OUT = 'frontend/airtable-schema.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);
const JSX_EXTENSIONS = new Set(['.jsx', '.tsx']);
// What the blocks scaffold imports for its side effects (`import './style.css'`).
const ASSET_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']);
// TypeScript 6 flipped `noUncheckedSideEffectImports` on by default (TS2882 on those imports).
const CHECKS_SIDE_EFFECT_IMPORTS_FROM = 6;
const NODE_RESOLUTION = new Set(['node16', 'nodenext']);
const NODE_MODULE = new Set(['node16', 'node18', 'node20', 'nodenext']);
// tsc's own default when a config has no `exclude`.
const DEFAULT_EXCLUDE = ['node_modules', 'bower_components', 'jspm_packages'];
const MAX_SOURCES = 5000;

/**
 * The config airgen creates, and the shape `fix-tsconfig` steers toward.
 * `typescriptMajor` is the project's compiler (null when not installed): from
 * 6 on, side-effect imports are checked by default and the scaffold's CSS
 * import fails, so the key that turns that off is written only where it's
 * both needed and known (TS 5.5 and older reject the option as unknown).
 */
export function recommendedConfig(include, {typescriptMajor = null} = {}) {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
      allowJs: true,
      checkJs: true,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      ...(checksSideEffectImports(typescriptMajor) ? {noUncheckedSideEffectImports: false} : {}),
    },
    include: [include],
  };
}

const checksSideEffectImports = major => major !== null && major >= CHECKS_SIDE_EFFECT_IMPORTS_FROM;

/**
 * Parses tsconfig-flavored JSON: `//` and `/* *\/` comments and trailing
 * commas are allowed, as tsc allows them. Throws on anything else.
 */
export function parseJsonc(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      out += text.slice(start, ++i);
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (ch === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] !== '}' && text[j] !== ']') out += ch;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return JSON.parse(out);
}

const toPosix = file => file.split(path.sep).join('/');

/** tsc's include/exclude wildcards (`**`, `*`, `?`) as a regex over posix paths. */
function patternRegex(pattern, {directoryPrefix}) {
  // A trailing `/**` means the directory and everything in it.
  if (pattern.endsWith('/**')) return patternRegex(pattern.slice(0, -3), {directoryPrefix: true});
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*' && (pattern[i + 2] === '/' || i + 2 === pattern.length)) {
      source += '(?:[^/]+/)*';
      i += 2;
    } else if (ch === '*') {
      source += '[^/]*';
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  // An include segment with no wildcard and no extension names a directory;
  // excludes always match everything below them.
  const last = pattern.split('/').pop() ?? '';
  const isDirectory = !/[*?]/.test(last) && path.extname(last) === '';
  if (directoryPrefix || isDirectory) source = `${source.replace(/\/$/, '')}(?:/.*)?`;
  return new RegExp(`^${source}$`);
}

function resolvePattern(configDir, pattern) {
  return toPosix(path.resolve(configDir, pattern));
}

/** Whether `file` (absolute) is part of the program the raw config describes. */
function isCovered(file, raw, configDir) {
  const target = toPosix(file);
  const listed = Array.isArray(raw.files) ? raw.files : [];
  if (listed.some(entry => typeof entry === 'string' && resolvePattern(configDir, entry) === target)) return true;

  const include = Array.isArray(raw.include) ? raw.include : listed.length > 0 ? [] : ['**/*'];
  const exclude = Array.isArray(raw.exclude) ? raw.exclude : DEFAULT_EXCLUDE;
  const matches = (patterns, options) =>
    patterns.some(
      pattern => typeof pattern === 'string' && patternRegex(resolvePattern(configDir, pattern), options).test(target),
    );
  return matches(include, {directoryPrefix: false}) && !matches(exclude, {directoryPrefix: true});
}

/**
 * Source files under dir (the generated file's directory), node_modules
 * skipped, plus the stylesheets and images beside them (`assets`).
 */
function listSources(dir) {
  const sources = [];
  const assets = [];
  const walk = current => {
    let entries;
    try {
      entries = fs.readdirSync(current, {withFileTypes: true});
    } catch {
      return;
    }
    for (const entry of entries) {
      if (sources.length >= MAX_SOURCES) return;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      const extension = path.extname(entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_EXTENSIONS.has(extension)) sources.push(full);
      else if (ASSET_EXTENSIONS.has(extension)) assets.push(full);
    }
  };
  walk(dir);
  return {sources, assets};
}

const lower = value => (typeof value === 'string' ? value.toLowerCase() : undefined);

/**
 * What `fix-tsconfig` would change, without touching anything. Pure apart from
 * reading the config and listing the sources, so the typechecker can run it on
 * every check and the panel shows exactly what the command will do.
 *
 * @param {{cwd: string, outPath: string}} options outPath is absolute
 * @returns {{action: 'create' | 'update' | 'none', configPath: string | null,
 *   changes: {option: string, value: unknown, reason: string}[],
 *   next?: object, parseError?: string, notes: string[]}}
 */
export function planConfigFix({cwd, outPath}) {
  const outDir = path.dirname(outPath);
  const configPath = findProjectConfig(outDir);

  if (configPath === null) {
    const relative = path.relative(cwd, outDir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return {
        action: 'none',
        configPath: null,
        changes: [],
        notes: ['the output file is outside this directory; run airgen from your project root'],
      };
    }
    const next = recommendedConfig(toPosix(relative) || '.', {typescriptMajor: typescriptMajor(cwd)});
    return {
      action: 'create',
      configPath: path.join(cwd, 'tsconfig.json'),
      changes: [{option: 'tsconfig.json', value: next, reason: 'no tsconfig.json or jsconfig.json found'}],
      next,
      notes: [],
    };
  }

  let raw;
  try {
    raw = parseJsonc(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {action: 'none', configPath, changes: [], parseError: error?.message ?? String(error), notes: []};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {action: 'none', configPath, changes: [], parseError: 'expected a JSON object', notes: []};
  }

  const configDir = path.dirname(configPath);
  const isJsconfig = path.basename(configPath) === 'jsconfig.json';
  const options = typeof raw.compilerOptions === 'object' && raw.compilerOptions !== null ? raw.compilerOptions : {};
  const listed = listSources(outDir);
  const sources = [...new Set([outPath, ...listed.sources])];
  const major = typescriptMajor(cwd);
  const changes = [];
  const nextOptions = {...options};
  const next = {...raw, compilerOptions: nextOptions};

  if (sources.some(file => !isCovered(file, raw, configDir))) {
    const entry = toPosix(path.relative(configDir, outDir)) || '.';
    const include = Array.isArray(raw.include) ? [...raw.include, entry] : [entry];
    next.include = include;
    changes.push({option: 'include', value: include, reason: `"include" doesn't cover ${entry}/`});
  }

  const hasJs = sources.some(file => JS_EXTENSIONS.has(path.extname(file)));
  if (hasJs && !isJsconfig && options.allowJs !== true) {
    nextOptions.allowJs = true;
    changes.push({option: 'allowJs', value: true, reason: 'JavaScript sources are skipped without "allowJs"'});
  }

  // `block init` writes its JSX in plain .js files, which tsc parses as JSX
  // too, so JS sources need the option as much as .jsx/.tsx ones.
  const hasJsx = sources.some(file => JSX_EXTENSIONS.has(path.extname(file)));
  if ((hasJsx || hasJs) && options.jsx === undefined) {
    nextOptions.jsx = 'react-jsx';
    changes.push({
      option: 'jsx',
      value: 'react-jsx',
      reason: hasJsx
        ? 'JSX files need a "jsx" option'
        : 'JSX in .js files (as the blocks scaffold writes it) needs a "jsx" option',
    });
  }

  if (Array.isArray(options.lib) && !options.lib.some(entry => lower(entry) === 'dom')) {
    nextOptions.lib = [...options.lib, 'DOM'];
    changes.push({
      option: 'lib',
      value: nextOptions.lib,
      reason: 'the extension runs in a browser, but "lib" leaves out "DOM"',
    });
  }

  if (
    listed.assets.length > 0 &&
    options.noUncheckedSideEffectImports === undefined &&
    checksSideEffectImports(major)
  ) {
    nextOptions.noUncheckedSideEffectImports = false;
    changes.push({
      option: 'noUncheckedSideEffectImports',
      value: false,
      reason: `TypeScript ${major} rejects side-effect imports like "import './style.css'" by default`,
    });
  }

  const resolution = lower(options.moduleResolution);
  if (NODE_RESOLUTION.has(resolution) || (resolution === undefined && NODE_MODULE.has(lower(options.module)))) {
    // Bundler resolution arrived in TS 5.0; older compilers get classic node.
    const bundler = major === null || major >= 5 ? 'Bundler' : 'Node';
    nextOptions.module = 'ESNext';
    nextOptions.moduleResolution = bundler;
    changes.push({
      option: 'moduleResolution',
      value: bundler,
      reason: `"${options.moduleResolution ?? options.module}" requires file extensions on imports; the blocks bundler doesn't`,
    });
  }

  const notes = [];
  if (sources.some(file => !isCovered(file, next, configDir))) {
    notes.push('some sources are still excluded: check "exclude" (and "extends")');
  }
  return {action: changes.length > 0 ? 'update' : 'none', configPath, changes, next, notes};
}

/**
 * Applies a plan. An update keeps every key the config already had; when the
 * original wasn't plain JSON (comments, trailing commas) it is copied to
 * `<config>.bak` first, since rewriting drops the comments.
 * @returns {{action: 'created' | 'updated' | 'unchanged', configPath: string | null, backupPath: string | null, plan: ReturnType<typeof planConfigFix>}}
 */
export function applyConfigFix(plan) {
  if (plan.action === 'none') {
    return {action: 'unchanged', configPath: plan.configPath, backupPath: null, plan};
  }
  const text = `${JSON.stringify(plan.next, null, 2)}\n`;
  if (plan.action === 'create') {
    fs.writeFileSync(plan.configPath, text, {encoding: 'utf8', flag: 'wx'});
    return {action: 'created', configPath: plan.configPath, backupPath: null, plan};
  }

  const original = fs.readFileSync(plan.configPath, 'utf8');
  let backupPath = null;
  try {
    JSON.parse(original);
  } catch {
    backupPath = `${plan.configPath}.bak`;
    fs.writeFileSync(backupPath, original, 'utf8');
  }
  fs.writeFileSync(plan.configPath, text, 'utf8');
  return {action: 'updated', configPath: plan.configPath, backupPath, plan};
}

/**
 * The command the panel tells the user to run. `-o` is spelled out whenever
 * the output isn't the default, so the command fixes the config for the file
 * this daemon actually writes.
 */
export function fixCommand(cwd, outPath) {
  const relative = toPosix(path.relative(cwd, outPath));
  if (relative === DEFAULT_OUT) return 'npx airgen fix-tsconfig';
  return `npx airgen fix-tsconfig -o ${/^[\w./-]+$/.test(relative) ? relative : JSON.stringify(relative)}`;
}
