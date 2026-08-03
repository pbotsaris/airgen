import {airtableColorToHex, shouldUseLightText} from '../colors.js';

export interface BadgeOptions {
  id?: string;
  name?: string;
  /** Airtable color name or CSS hex; omitted → neutral pill. */
  color?: string;
}

export interface BadgeProps {
  opts: BadgeOptions | null | undefined;
  variant?: 'sm' | 'md';
}

/**
 * Colored pill for a select choice-shaped value. Colorless options render a
 * neutral pill; anything without a `name` renders a safe "Invalid" fallback
 * instead of throwing.
 */
export function Badge({opts, variant = 'sm'}: BadgeProps) {
  if (!opts || opts.name == null) return <InvalidBadge opts={opts} />;

  const color = opts.color ? airtableColorToHex(opts.color) : null;
  const bg = color ?? '#eeeeee';
  const textColor = opts.color && shouldUseLightText(opts.color) ? '#ffffff' : 'rgba(0,0,0,0.72)';

  const textSize = variant === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div
      className={'inline-block px-2 py-0.5 rounded-full font-medium ' + textSize}
      style={{backgroundColor: bg, color: textColor}}
    >
      {opts.name}
    </div>
  );
}

function InvalidBadge({opts}: {opts: BadgeOptions | null | undefined}) {
  console.error('Badge component rendered with invalid badge options: ', opts);
  return <div>Invalid</div>;
}
