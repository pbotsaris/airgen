/**
 * ThemeProvider forces the `dark:` variant on or off instead of following the
 * frame's prefers-color-scheme, portals included.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import * as React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Select} from '../src/components/Select.js';
import {ThemeProvider, type ColorScheme} from '../src/providers/ThemeProvider.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function compileCss(): string {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-ui-theme-')), 'styles.css');
  const cli = createRequire(import.meta.url).resolve('tailwindcss/lib/cli.js');
  execFileSync(process.execPath, [cli, '-c', 'tailwind.config.cjs', '-i', 'src/styles.css', '-o', out], {
    cwd: packageDir,
    stdio: 'ignore',
  });
  return fs.readFileSync(out, 'utf8');
}

const OPTIONS = [{value: 'apple', label: 'Apple'}];

function Themed({scheme}: {scheme: ColorScheme}) {
  return (
    <ThemeProvider colorScheme={scheme}>
      <Select options={OPTIONS} onChange={() => {}} />
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  it('toggling colorScheme flips a dark: class on a portalled Select menu', async () => {
    const css = compileCss();
    // The selector the config emits for the provider form of the variant,
    // kept as is; the declaration is swapped for a color jsdom can compare.
    const selector = /(\.dark\\:ag-text-neutral-100:where\(\[data-ag-theme="dark"\] \*\))\s*\{/.exec(css)?.[1];
    expect(selector, 'no provider-scoped dark rule in the stylesheet').toBeDefined();
    const style = document.createElement('style');
    style.textContent = `${selector} { color: rgb(9, 8, 7); }`;
    document.head.appendChild(style);

    try {
      const user = userEvent.setup();
      const {rerender, container} = render(<Themed scheme="dark" />);
      await user.click(screen.getByRole('button'));
      const option = screen.getByRole('option', {name: 'Apple'});

      // The menu is portalled out of the provider's element, yet scoped.
      expect(container.contains(option)).toBe(false);
      expect(option.closest('[data-ag-theme]')?.getAttribute('data-ag-theme')).toBe('dark');
      expect(getComputedStyle(option).color).toBe('rgb(9, 8, 7)');

      rerender(<Themed scheme="light" />);
      expect(option.closest('[data-ag-theme]')?.getAttribute('data-ag-theme')).toBe('light');
      expect(getComputedStyle(option).color).not.toBe('rgb(9, 8, 7)');
    } finally {
      style.remove();
    }
  }, 30_000);

  it('the OS media query still applies outside a light provider', () => {
    const css = compileCss();
    // Tailwind closes each top-level block with "\n}\n".
    const mediaBlocks = css
      .split('@media (prefers-color-scheme: dark)')
      .slice(1)
      .map(rest => rest.slice(0, rest.indexOf('\n}\n')));
    expect(
      mediaBlocks.some(block =>
        block.includes('.dark\\:ag-text-neutral-100:not(:where([data-ag-theme="light"] *))'),
      ),
    ).toBe(true);
  }, 30_000);

  it('without a provider, portals add no wrapper', async () => {
    const user = userEvent.setup();
    render(<Select options={OPTIONS} onChange={() => {}} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('option', {name: 'Apple'}).closest('[data-ag-theme]')).toBeNull();
  });
});
