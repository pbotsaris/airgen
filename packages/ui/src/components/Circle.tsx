import {airtableColorToHex} from '../colors.js';

export interface CircleProps {
  /** Airtable color name, CSS hex, or any CSS color; null renders nothing. */
  color: string | null;
}

/** Small color dot (select choice indicator). */
export function Circle({color}: CircleProps) {
  if (!color) return null;

  const resolved = airtableColorToHex(color) ?? color;

  return <span className="h-2 w-2 flex-none rounded-full ring-1 ring-black/10" style={{background: resolved}} />;
}
