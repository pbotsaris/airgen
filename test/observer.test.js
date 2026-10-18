/**
 * The observer's palette follows Airtable's theme through the adapter's
 * `useColorScheme`. Rendered to static markup: effects (daemon polling) never
 * run, so this needs no DOM and no daemon.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import {createSchemaObserver} from '../dist/client/SchemaObserver.js';
import {mockBase} from './fixtures/mock-base.js';

function render(adapterExtras) {
  const SchemaObserver = createSchemaObserver({
    useBase: () => mockBase,
    useWatchable: () => {},
    useRecords: () => null,
    ...adapterExtras,
  });
  return renderToStaticMarkup(React.createElement(SchemaObserver));
}

const buttonStyle = markup => /<button[^>]*style="([^"]*)"/.exec(markup)?.[1] ?? '';

test('a dark Airtable theme paints the strip and lifts the button off it', () => {
  const markup = render({useColorScheme: () => ({colorScheme: 'dark'})});
  assert.match(markup, /background:#1e1e1e/);
  assert.match(buttonStyle(markup), /background:rgba\(255, 255, 255, 0.12\)/);
  assert.match(buttonStyle(markup), /color:#f0f0f0/);
});

test('light, and an adapter without useColorScheme, keep the light palette', () => {
  const light = render({useColorScheme: () => ({colorScheme: 'light'})});
  assert.equal(render({}), light);
  assert.match(buttonStyle(light), /background:rgba\(0, 0, 0, 0.05\)/);
  assert.match(buttonStyle(light), /color:#333333/);
  assert.doesNotMatch(light, /#1e1e1e/);
});
