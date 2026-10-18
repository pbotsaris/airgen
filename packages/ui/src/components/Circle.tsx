import {airtableColorToHex} from '../colors.js';

export interface CircleProps {
  /** Airtable color name, CSS hex, or any CSS color; null renders nothing. */
  color: string | null;
}

/** Small color dot (select choice indicator). */
export function Circle({color}: CircleProps) {
  if (!color) return null;

  const resolved = airtableColorToHex(color) ?? color;

  return <span className="ag-h-2 ag-w-2 ag-flex-none ag-rounded-full ag-ring-1 ag-ring-black/10" style={{background: resolved}} />;
}
