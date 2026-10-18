/**
 * The package's utilities are `ag-` prefixed so the consumer's own Tailwind
 * (the interface scaffold runs one over `frontend/`) can never emit the same
 * selector and win on load order, which used to override the package's dark
 * variants with the consumer's plain rule.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import * as React from 'react';
import {render} from '@testing-library/react';

import {Badge} from '../src/components/Badge';
import {Button} from '../src/components/Button';
import {ButtonToggle} from '../src/components/ButtonToggle';
import {Input} from '../src/components/Input';
import {Text} from '../src/components/Text';
import {Toggle} from '../src/components/Toggle';
import {RecordTable} from '../src/components/Table';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'ag-';

/** The utility part of a class token: variants (`dark:`, `data-[…]:`), `!` and `-` stripped. */
function utilityOf(token: string): string {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === '[') depth++;
    else if (token[i] === ']') depth--;
    else if (token[i] === ':' && depth === 0) last = i + 1;
  }
  return token.slice(last).replace(/^!/, '').replace(/^-/, '');
}

function compileCss(): string {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'airgen-ui-css-')), 'styles.css');
  const cli = createRequire(import.meta.url).resolve('tailwindcss/lib/cli.js');
  execFileSync(process.execPath, [cli, '-c', 'tailwind.config.cjs', '-i', 'src/styles.css', '-o', out], {
    cwd: packageDir,
    stdio: 'ignore',
  });
  return fs.readFileSync(out, 'utf8');
}

/** Class names in the stylesheet's selectors, CSS escapes decoded. */
function selectorClasses(css: string): string[] {
  const withoutBlocks = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}');
  const classes = new Set<string>();
  for (const match of withoutBlocks.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)) {
    classes.add(
      match[1]
        .replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/\\(.)/g, '$1'),
    );
  }
  return [...classes];
}

describe('ag- prefix', () => {
  test('every utility selector in the compiled stylesheet carries the prefix', () => {
    const classes = selectorClasses(compileCss());
    expect(classes.length).toBeGreaterThan(100);
    expect(classes.filter(name => !utilityOf(name).startsWith(PREFIX))).toEqual([]);
  }, 30_000);

  test('components render only prefixed utilities, plus the classes the consumer passes', () => {
    const {container} = render(
      <div>
        <Text variant="title">Title</Text>
        <Text variant="muted" bold italic underline>
          Muted
        </Text>
        <Button>Save</Button>
        <ButtonToggle checked={false} onChange={() => {}}>
          Toggle
        </ButtonToggle>
        <Badge opts={{id: 'a', name: 'A', color: 'blueBright'}} />
        <Input value="" onChange={() => {}} />
        <Toggle checked onChange={() => {}} label="On" />
        <RecordTable records={[{id: 'rec1', fields: {name: 'One'}}]} columns={['name']} />
        <Text className="consumer-class">Consumer</Text>
      </div>,
    );
    const tokens = [...container.querySelectorAll<HTMLElement>('[class]')].flatMap(el =>
      typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : [],
    );
    expect(tokens.length).toBeGreaterThan(20);
    expect(tokens.filter(token => token !== 'consumer-class' && !utilityOf(token).startsWith(PREFIX))).toEqual([]);
  });

  test("a consumer stylesheet's unprefixed utility no longer restyles Text", () => {
    const style = document.createElement('style');
    style.textContent = '.text-neutral-900 { color: rgb(1, 2, 3); }';
    document.head.appendChild(style);
    try {
      const {getByText} = render(
        <div>
          <Text variant="title">Package</Text>
          <span className="text-neutral-900">Consumer</span>
        </div>,
      );
      // The control proves jsdom applies the rule at all.
      expect(getComputedStyle(getByText('Consumer')).color).toBe('rgb(1, 2, 3)');
      expect(getComputedStyle(getByText('Package')).color).not.toBe('rgb(1, 2, 3)');
    } finally {
      style.remove();
    }
  });
});
