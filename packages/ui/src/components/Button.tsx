import * as React from 'react';
import {Icon, type IconComponent} from './Icon.js';
import {cx} from '../utils.js';
import {controlSizeClasses, type IconSize} from '../sizes.js';
import {airtableColorToHex} from '../colors.js';

const variants = {
  default: 'ag-bg-neutral-700 ag-text-white hover:ag-bg-neutral-600',
  outline:
    'ag-border ag-border-neutral-300 ag-bg-white ag-text-neutral-900 hover:ag-bg-neutral-100 dark:ag-border-neutral-600 dark:ag-bg-neutral-800 dark:ag-text-neutral-100 dark:hover:ag-bg-neutral-700',
  destructive: 'ag-bg-rose-600 ag-text-white hover:ag-bg-rose-700',
  secondary:
    'ag-bg-neutral-200 ag-text-neutral-900 hover:ag-bg-neutral-300 dark:ag-bg-neutral-700 dark:ag-text-neutral-100 dark:hover:ag-bg-neutral-600',
  ghost: 'hover:ag-bg-neutral-100 dark:hover:ag-bg-neutral-700',
  link: 'ag-underline ag-underline-offset-4 ag-decoration-neutral-300 hover:ag-decoration-neutral-500 dark:ag-decoration-neutral-600 dark:hover:ag-decoration-neutral-400 ag-transition-all ag-text-neutral-700 dark:ag-text-neutral-300',
};

// Shared scale (see sizes.ts); min-w keeps toggle labels from causing layout jumps
const sizes = {
  xs: controlSizeClasses('xs'),
  sm: `${controlSizeClasses('sm')} ag-min-w-[62px]`,
  base: controlSizeClasses('base'),
  default: controlSizeClasses('base'),
  lg: controlSizeClasses('lg'),
  xl: controlSizeClasses('xl'),
  icon: 'ag-h-8 ag-w-8 ag-p-0',
  'icon-xs': 'ag-h-5 ag-w-5 ag-p-0',
  'icon-sm': 'ag-h-6 ag-w-6 ag-p-0',
  'icon-lg': 'ag-h-9 ag-w-9 ag-p-0',
  'icon-xl': 'ag-h-10 ag-w-10 ag-p-0',
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

/** Maps button icon sizes to Icon component sizes */
const iconSizeMap: Record<ButtonSize, IconSize> = {
  xs: 'xs',
  sm: 'sm',
  base: 'base',
  default: 'base',
  lg: 'lg',
  xl: 'xl',
  'icon-xs': 'xs',
  'icon-sm': 'sm',
  icon: 'base',
  'icon-lg': 'lg',
  'icon-xl': 'xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button. */
  variant?: ButtonVariant;
  /** Size variant of the button. */
  size?: ButtonSize;
  /** A lucide-react icon component. Auto-sizes based on button size. */
  icon?: IconComponent;
  /** Override the auto-selected icon size. */
  iconSize?: IconSize | number;
  /**
   * Color applied to the button's text and icon (icons stroke with
   * `currentColor`). Accepts an Airtable color name, CSS hex, or any CSS
   * color. Overrides the variant's text color. To recreate the old
   * `useAirtableHighlight` behavior, pass the flavor entry's
   * `useBaseHighlight()` result here.
   */
  color?: string;
}

/** Button component with multiple variants and sizes. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {className, variant = 'default', size = 'default', icon, iconSize, color, style, children, ...props},
  ref,
) {
  const baseClasses =
    'ag-inline-flex ag-items-center ag-justify-center ag-gap-2 ag-rounded-md ag-font-medium ag-transition-all disabled:ag-pointer-events-none disabled:ag-opacity-50 focus-visible:ag-outline-none focus-visible:ag-ring-2 focus-visible:ag-ring-offset-2';

  const resolvedIconSize = iconSize || iconSizeMap[size] || 'base';

  // Setting CSS `color` cascades to the label text and to the icon (lucide
  // strokes with `currentColor`).
  const resolvedColor = color ? airtableColorToHex(color) ?? color : undefined;

  return (
    <button
      ref={ref}
      className={cx(baseClasses, variants[variant], sizes[size], className)}
      style={resolvedColor ? {color: resolvedColor, ...style} : style}
      {...props}
    >
      {icon && <Icon icon={icon} size={resolvedIconSize} />}
      {children}
    </button>
  );
});
