import {cx} from '../utils.js';
import {NEUTRAL_PILL_CLASSES, airtableColorToHex, shouldUseLightText} from '../colors.js';
import {PILL_SIZE, type ComponentSize} from '../sizes.js';
import type {SelectOption} from '../types.js';

export interface PillOptionProps {
  /** Option whose label, color, and optional avatar are displayed. */
  opt: SelectOption;
  /** Control size the pill nests in. */
  size?: ComponentSize;
  className?: string;
  /** Optional override hex background. */
  bg?: string;
  /** Override automatic contrast; useful with a custom `bg`. */
  useLightText?: boolean;
  /** If false, just render label (and avatar if present) without the pill chrome. */
  show?: boolean;
}

/**
 * Renders a pill for a select option:
 * - If profilePicUrl exists => avatar pill (neutral bg unless you override)
 * - Else if color exists => colored pill bg + auto text color
 * - Else => neutral pill
 *
 * `opt.color` may be an Airtable color name or CSS hex. This is display-only;
 * use Select for interactive selection.
 *
 * @example
 * ```tsx
 * <PillOption opt={{value: 'done', label: 'Done', color: 'greenBright'}} size="sm" />;
 * ```
 */
export function PillOption({opt, size = 'base', className, bg, useLightText, show = true}: PillOptionProps) {
  const s = PILL_SIZE[size] || PILL_SIZE.base;
  const label = opt?.label ?? '';
  const pic = opt?.profilePicUrl ?? null;

  // No background of its own → the neutral classes, which follow dark mode.
  const derivedBg = bg ?? (!pic && opt?.color ? airtableColorToHex(opt.color) : null);

  const derivedUseLight = useLightText ?? (!pic && opt?.color ? shouldUseLightText(opt.color) : false);

  const colorStyle = derivedBg
    ? {background: derivedBg, color: derivedUseLight ? '#ffffff' : 'rgba(0,0,0,0.72)'}
    : useLightText != null
      ? {color: useLightText ? '#ffffff' : 'rgba(0,0,0,0.72)'}
      : undefined;

  // If not showing pill, render "plain"
  if (!show) {
    return (
      <span className={cx('ag-inline-flex ag-items-center ag-min-w-0', s.gap, className)}>
        {pic ? <img src={pic} alt="" className={cx(s.avatar, 'ag-rounded-full ag-ring-1 ag-ring-black/10')} /> : null}
        <span className="ag-truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cx(
        'ag-inline-flex ag-items-center ag-rounded-full',
        s.gap,
        s.pad,
        s.text,
        'ag-leading-none',
        'ag-ring-1 ag-ring-black/10',
        'ag-min-w-0 ag-max-w-full', // allows inner truncate to work
        !derivedBg && NEUTRAL_PILL_CLASSES,
        className,
      )}
      style={colorStyle}
      title={typeof label === 'string' ? label : undefined}
    >
      {pic ? <img src={pic} alt="" className={cx(s.avatar, 'ag-rounded-full ag-ring-1 ag-ring-black/10')} /> : null}

      <span className="ag-truncate">{label}</span>
    </span>
  );
}
