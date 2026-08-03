/**
 * Vendored Airtable color palette. Components accept an Airtable color name
 * (e.g. "blueBright") or a CSS hex anywhere a color prop exists; resolving
 * names here — instead of importing `colorUtils` from an SDK flavor — is what
 * lets every component ship SDK-import-free.
 */
import {AIRTABLE_COLORS} from './colors-table.js';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

/**
 * Resolves an Airtable color name to hex; hex values pass through unchanged.
 * Unknown names (and other CSS color syntaxes) return null — callers decide
 * the fallback.
 */
export function airtableColorToHex(color: string | null | undefined): string | null {
  if (!color) return null;
  if (isHexColor(color)) return color;
  return AIRTABLE_COLORS[color]?.[0] ?? null;
}

function hexLuminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Whether text over this background should be light. Airtable names use the
 * SDK's own answer (baked into the table); hex falls back to a perceived
 * luminance check.
 */
export function shouldUseLightText(color: string | null | undefined): boolean {
  if (!color) return false;
  const known = AIRTABLE_COLORS[color];
  if (known) return known[1];
  if (isHexColor(color)) return hexLuminance(color) < 0.55;
  return false;
}
