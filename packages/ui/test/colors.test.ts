import {describe, expect, test} from 'vitest';
import {AIRTABLE_COLORS} from '../src/colors-table';
import {airtableColorToHex, isHexColor, shouldUseLightText} from '../src/colors';

describe('vendored palette', () => {
  test('carries the full SDK palette', () => {
    expect(Object.keys(AIRTABLE_COLORS).length).toBe(50);
  });

  test('resolves Airtable color names to hex', () => {
    expect(airtableColorToHex('blueBright')).toBe('#2d7ff9');
    expect(airtableColorToHex('grayLight2')).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('hex passes through unchanged, any case and 3-digit form', () => {
    expect(airtableColorToHex('#A1B2C3')).toBe('#A1B2C3');
    expect(airtableColorToHex('#fff')).toBe('#fff');
  });

  test('unknown names and empty input return null', () => {
    expect(airtableColorToHex('notAColor')).toBe(null);
    expect(airtableColorToHex(null)).toBe(null);
    expect(airtableColorToHex(undefined)).toBe(null);
    expect(airtableColorToHex('')).toBe(null);
  });

  test('light-text decisions come from the SDK table for names', () => {
    expect(shouldUseLightText('blueBright')).toBe(true);
    expect(shouldUseLightText('blueLight2')).toBe(false);
  });

  test('light-text for raw hex falls back to luminance', () => {
    expect(shouldUseLightText('#000000')).toBe(true);
    expect(shouldUseLightText('#ffffff')).toBe(false);
    expect(shouldUseLightText('not-a-color')).toBe(false);
  });

  test('isHexColor accepts 3- and 6-digit forms only', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#aabbcc')).toBe(true);
    expect(isHexColor('#abcd')).toBe(false);
    expect(isHexColor('abc')).toBe(false);
  });
});
