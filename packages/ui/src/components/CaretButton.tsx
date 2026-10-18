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
  'icon-xs': 'ag-text-xs',
  'icon-sm': 'ag-text-sm',
  icon: 'ag-text-base',
  'icon-lg': 'ag-text-base',
  'icon-xl': 'ag-text-lg',
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
        'ag-flex-none ag-text-neutral-500',
        'dark:ag-border-neutral-600 dark:ag-bg-neutral-800 dark:ag-text-neutral-400 dark:hover:ag-bg-neutral-700',
        label != null && label !== '' && 'ag-w-auto ag-gap-[4px] ag-pl-1.5 ag-pr-2',
        className,
      )}
      {...props}
    >
      <Caret size={caretSizeMap[size] || 'sm'} weight={2} direction={open ? 'down' : direction} />
      {label != null && label !== '' && (
        <span className={cx('ag-whitespace-nowrap ag-font-medium', labelSizeMap[size] || 'ag-text-sm')}>{label}</span>
      )}
    </Button>
  );
});
