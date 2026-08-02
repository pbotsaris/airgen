import fs from 'node:fs';
import path from 'node:path';

/**
 * Symlinks packages into dir/node_modules so a spawned tsc resolves them
 * exactly like a consumer project. `links` maps package name → real path.
 */
export function linkIntoNodeModules(dir, links) {
  const nodeModules = path.join(dir, 'node_modules');
  fs.mkdirSync(nodeModules, {recursive: true});
  for (const [name, target] of Object.entries(links)) {
    fs.symlinkSync(target, path.join(nodeModules, name), 'dir');
  }
}
