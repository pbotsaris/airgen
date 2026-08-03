import * as React from 'react';
import {Button, type ButtonSize, type ButtonVariant} from './Button.js';
import {Caret} from './Caret.js';
import {cx} from '../utils.js';

/** Maps button sizes to Caret sizes */
const caretSizeMap: Record<string, 'sm' | 'md' | 'lg'> = {
  'icon-xs': 'sm',
  'icon-sm': 'sm',
  icon: 'md',
  'icon-lg': 'lg',
  'icon-xl': 'lg',
};

/** Maps button sizes to label text classes (one visual step up from the caret) */
const labelSizeMap: Record<string, string> = {
  'icon-xs': 'text-xs',
  'icon-sm': 'text-sm',
  icon: 'text-base',
  'icon-lg': 'text-base',
  'icon-xl': 'text-lg',
};

export interface CaretButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true the caret points down (menu open). */
  open?: boolean;
  /** Resting caret direction when closed. */
  direction?: 'down' | 'up' | 'left' | 'right';
  /** Optional text rendered to the right of the caret (widens the button). */
  label?: React.ReactNode;
  variant?: ButtonVariant;
  /** Size variant (icon sizes recommended). */
  size?: ButtonSize;
}

/**
 * A small square button with an animated caret, for expanding/collapsing menus
 * or panels. Forwards its ref to the underlying button so it can anchor
 * popovers/pickers.
 */
export const CaretButton = React.forwardRef<HTMLButtonElement, CaretButtonProps>(function CaretButton(
  {open = false, direction = 'left', label, variant = 'outline', size = 'icon-sm', className, ...props},
  ref,
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant={variant}
      size={size}
      aria-expanded={open}
      className={cx(
        'flex-none text-neutral-500',
        'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700',
        label != null && label !== '' && 'w-auto gap-[4px] pl-1.5 pr-2',
        className,
      )}
      {...props}
    >
      <Caret size={caretSizeMap[size] || 'sm'} weight={2} direction={open ? 'down' : direction} />
      {label != null && label !== '' && (
        <span className={cx('whitespace-nowrap font-medium', labelSizeMap[size] || 'text-sm')}>{label}</span>
      )}
    </Button>
  );
});
