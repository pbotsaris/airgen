import {NEUTRAL_PILL_CLASSES, airtableColorToHex, shouldUseLightText} from '../colors.js';
import {cx} from '../utils.js';

export interface BadgeOptions {
  id?: string;
  name?: string;
  /** Airtable color name or CSS hex; omitted → neutral pill. */
  color?: string;
}

export interface BadgeProps {
  /** Choice to display; requires a `name` for valid output. */
  opts: BadgeOptions | null | undefined;
  /** Label size. @defaultValue 'sm' */
  variant?: 'sm' | 'md';
}

/**
 * Colored pill for a select choice-shaped value. Colorless options render a
 * neutral pill; anything without a `name` renders a safe "Invalid" fallback
 * instead of throwing (and logs an error).
 *
 * @example
 * ```tsx
 * <Badge opts={{name: 'Done', color: 'greenBright'}} />;
 * ```
 */
export function Badge({opts, variant = 'sm'}: BadgeProps) {
  if (!opts || opts.name == null) return <InvalidBadge opts={opts} />;

  const color = opts.color ? airtableColorToHex(opts.color) : null;
  const textColor = opts.color && shouldUseLightText(opts.color) ? '#ffffff' : 'rgba(0,0,0,0.72)';

  const textSize = variant === 'sm' ? 'ag-text-sm' : 'ag-text-base';

  // One line, truncated: a pill that wraps in a narrow table cell turns into a
  // blob with the text pushed to one side.
  return (
    <span
      className={cx(
        'ag-inline-flex ag-items-center ag-max-w-full ag-min-w-0 ag-px-2 ag-py-0.5 ag-rounded-full ag-font-medium ag-whitespace-nowrap',
        textSize,
        !color && NEUTRAL_PILL_CLASSES,
      )}
      style={color ? {backgroundColor: color, color: textColor} : undefined}
      title={opts.name}
    >
      <span className="ag-truncate">{opts.name}</span>
    </span>
  );
}

function InvalidBadge({opts}: {opts: BadgeOptions | null | undefined}) {
  console.error('Badge component rendered with invalid badge options: ', opts);
  return <div>Invalid</div>;
}
