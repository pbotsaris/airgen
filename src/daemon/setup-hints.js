/**
 * Dev dependencies the typecheck says are missing, and the command that
 * installs them. The check runs with the consumer's own `typescript`, so what
 * tsc can't find is the consumer's to install; airgen bundles no types.
 *
 * The hints come from tsc's own messages, which already name the `@types`
 * package when its registry has one ("Try `npm i --save-dev @types/react`"),
 * so no package is ever suggested that tsc didn't. Pure apart from sniffing
 * the package manager, like `planConfigFix`, so it can run on every check.
 */

import fs from 'node:fs';
import path from 'node:path';

// The hint tsc appends to TS7016 (untyped module) and TS2580/TS2591 (node globals).
const TRY_INSTALL_RE = /`npm i(?:nstall)? --save-dev ((?:@[\w.-]+\/)?[\w.-]+)`/g;
// TS7016: the module the hint is about.
const UNTYPED_MODULE_RE = /^Could not find a declaration file for module '([^']+)'/;
// TS2688: a "types" entry with no package behind it.
const MISSING_TYPES_RE = /^Cannot find type definition file for '([^'/]+)'/;

const MAX_REASONS = 3;

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];
const INSTALL_DEV = {npm: 'npm i -D', pnpm: 'pnpm add -D', yarn: 'yarn add -D', bun: 'bun add -d'};

/** `packageManager` in package.json wins; a lockfile is the next best guess; npm otherwise. */
export function detectPackageManager(cwd) {
  try {
    const {packageManager} = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const name = typeof packageManager === 'string' ? packageManager.split('@')[0] : '';
    if (name in INSTALL_DEV) return name;
  } catch {
    // No package.json, or not JSON: the lockfile decides.
  }
  for (const [file, name] of LOCKFILES) {
    if (fs.existsSync(path.join(cwd, file))) return name;
  }
  return 'npm';
}

export function installCommand(cwd, packages) {
  return `${INSTALL_DEV[detectPackageManager(cwd)]} ${packages.join(' ')}`;
}

const firstSentence = message => message.split(/\.\s/, 1)[0].replace(/\.$/, '');

/**
 * What the panel shows about missing dev dependencies, or undefined when the
 * errors name none. `errors` are the typechecker's (messages already scrubbed).
 *
 * @param {{cwd: string, errors: {code: string, message: string}[], typescriptMissing?: boolean}} options
 * @returns {{command: string, packages: string[], issues: string[]} | undefined}
 */
export function planInstall({cwd, errors, typescriptMissing = false}) {
  /** package → {modules: untyped modules it covers, reasons: anything else} */
  const needs = new Map();
  const need = pkg => {
    if (!needs.has(pkg)) needs.set(pkg, {modules: new Set(), reasons: new Set()});
    return needs.get(pkg);
  };
  if (typescriptMissing) need('typescript').reasons.add('the typecheck runs your own tsc');

  for (const {message} of errors) {
    const untyped = UNTYPED_MODULE_RE.exec(message);
    for (const [, pkg] of message.matchAll(TRY_INSTALL_RE)) {
      if (untyped) need(pkg).modules.add(untyped[1]);
      else need(pkg).reasons.add(firstSentence(message));
    }
    const types = MISSING_TYPES_RE.exec(message);
    if (types) need(`@types/${types[1]}`).reasons.add(`"types" lists '${types[1]}'`);
  }
  if (needs.size === 0) return undefined;

  const packages = [...needs.keys()];
  const issues = packages.map(pkg => {
    const {modules, reasons} = needs.get(pkg);
    const parts = [];
    if (modules.size > 0) parts.push(`no type declarations for ${[...modules].map(m => `'${m}'`).join(', ')}`);
    parts.push(...[...reasons].slice(0, MAX_REASONS));
    if (reasons.size > MAX_REASONS) parts.push(`+${reasons.size - MAX_REASONS} more`);
    return `${pkg}: ${parts.join('; ')}`;
  });
  return {command: installCommand(cwd, packages), packages, issues};
}
