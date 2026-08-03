import {cx} from '../utils.js';
import {airtableColorToHex, shouldUseLightText} from '../colors.js';
import {PILL_SIZE, type ComponentSize} from '../sizes.js';
import type {SelectOption} from '../types.js';

export interface PillOptionProps {
  opt: SelectOption;
  /** Control size the pill nests in. */
  size?: ComponentSize;
  className?: string;
  /** Optional override hex background. */
  bg?: string;
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
 * `opt.color` may be an Airtable color name or CSS hex (resolved via colors.ts).
 */
export function PillOption({opt, size = 'base', className, bg, useLightText, show = true}: PillOptionProps) {
  const s = PILL_SIZE[size] || PILL_SIZE.base;
  const label = opt?.label ?? '';
  const pic = opt?.profilePicUrl ?? null;

  const derivedBg = bg ?? (!pic && opt?.color ? airtableColorToHex(opt.color) : null) ?? '#eeeeee';

  const derivedUseLight = useLightText ?? (!pic && opt?.color ? shouldUseLightText(opt.color) : false);

  const fg = derivedUseLight ? '#ffffff' : 'rgba(0,0,0,0.72)';

  // If not showing pill, render "plain"
  if (!show) {
    return (
      <span className={cx('inline-flex items-center min-w-0', s.gap, className)}>
        {pic ? <img src={pic} alt="" className={cx(s.avatar, 'rounded-full ring-1 ring-black/10')} /> : null}
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full',
        s.gap,
        s.pad,
        s.text,
        'leading-none',
        'ring-1 ring-black/10',
        'min-w-0 max-w-full', // allows inner truncate to work
        className,
      )}
      style={{background: derivedBg, color: fg}}
      title={typeof label === 'string' ? label : undefined}
    >
      {pic ? <img src={pic} alt="" className={cx(s.avatar, 'rounded-full ring-1 ring-black/10')} /> : null}

      <span className="truncate">{label}</span>
    </span>
  );
}
