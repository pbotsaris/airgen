import {cx} from '../utils.js';

export interface CaretProps {
  variant?: 'chevron' | 'triangle';
  size?: 'sm' | 'md' | 'lg';
  weight?: 1.5 | 2 | 2.5 | 3;
  open?: boolean;
  className?: string;
  direction?: 'down' | 'up' | 'left' | 'right';
}

export function Caret({
  variant = 'chevron',
  size = 'md',
  weight = 2.5,
  open = false,
  className,
  direction = 'down',
}: CaretProps) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  // base rotation for direction, plus optional "open" flip (nice for dropdowns)
  const dirRot =
    direction === 'up'
      ? 'rotate-180'
      : direction === 'left'
        ? 'rotate-90'
        : direction === 'right'
          ? '-rotate-90'
          : 'rotate-0';

  const openRot = open ? 'rotate-180' : 'rotate-0';

  // If direction is "down", open rotates 180. If you set direction other than
  // down, you probably don't want open-flip; this keeps it simple & consistent.
  const rotClass = cx('transition-transform duration-150', direction === 'down' ? openRot : dirRot);

  if (variant === 'triangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cx(sizeClass, 'text-neutral-500', rotClass, className)}>
        <path d="M7 10l5 6 5-6H7z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx(sizeClass, 'text-neutral-500', rotClass, className)}
      fill="none"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
