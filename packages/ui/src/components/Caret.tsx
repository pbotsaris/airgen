import {cx} from '../utils.js';

export interface CaretProps {
  /** Shape of the indicator. @defaultValue 'chevron' */
  variant?: 'chevron' | 'triangle';
  /** Indicator size. @defaultValue 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Chevron stroke width; ignored for triangles. @defaultValue 2.5 */
  weight?: 1.5 | 2 | 2.5 | 3;
  /** Flip a downward caret upward. @defaultValue false */
  open?: boolean;
  className?: string;
  /** Resting direction. @defaultValue 'down' */
  direction?: 'down' | 'up' | 'left' | 'right';
}

/**
 * Decorative, aria-hidden direction indicator. `open` flips a downward caret
 * upward; it has no effect when `direction` is up, left, or right.
 *
 * @example
 * ```tsx
 * <Caret open={expanded} />;
 * ```
 */
export function Caret({
  variant = 'chevron',
  size = 'md',
  weight = 2.5,
  open = false,
  className,
  direction = 'down',
}: CaretProps) {
  const sizeClass = size === 'sm' ? 'ag-h-3.5 ag-w-3.5' : size === 'lg' ? 'ag-h-5 ag-w-5' : 'ag-h-4 ag-w-4';

  // base rotation for direction, plus optional "open" flip (nice for dropdowns)
  const dirRot =
    direction === 'up'
      ? 'ag-rotate-180'
      : direction === 'left'
        ? 'ag-rotate-90'
        : direction === 'right'
          ? '-ag-rotate-90'
          : 'ag-rotate-0';

  const openRot = open ? 'ag-rotate-180' : 'ag-rotate-0';

  // If direction is "down", open rotates 180. If you set direction other than
  // down, you probably don't want open-flip; this keeps it simple & consistent.
  const rotClass = cx('ag-transition-transform ag-duration-150', direction === 'down' ? openRot : dirRot);

  if (variant === 'triangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cx(sizeClass, 'ag-text-neutral-500', rotClass, className)}>
        <path d="M7 10l5 6 5-6H7z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx(sizeClass, 'ag-text-neutral-500', rotClass, className)}
      fill="none"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
