import * as React from 'react';
import {Icon, type IconComponent} from './Icon.js';
import {cx} from '../utils.js';
import {controlSizeClasses, type IconSize} from '../sizes.js';
import {airtableColorToHex} from '../colors.js';

const variants = {
  default: 'bg-neutral-700 text-white hover:bg-neutral-600',
  outline: 'border border-neutral-300 bg-white hover:bg-neutral-100',
  destructive: 'bg-rose-600 text-white hover:bg-rose-700',
  secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300',
  ghost: 'hover:bg-neutral-100',
  link: 'underline underline-offset-4 decoration-neutral-300 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400 transition-all text-neutral-700 dark:text-neutral-300',
};

// Shared scale (see sizes.ts); min-w keeps toggle labels from causing layout jumps
const sizes = {
  xs: controlSizeClasses('xs'),
  sm: `${controlSizeClasses('sm')} min-w-[62px]`,
  base: controlSizeClasses('base'),
  default: controlSizeClasses('base'),
  lg: controlSizeClasses('lg'),
  xl: controlSizeClasses('xl'),
  icon: 'h-8 w-8 p-0',
  'icon-xs': 'h-5 w-5 p-0',
  'icon-sm': 'h-6 w-6 p-0',
  'icon-lg': 'h-9 w-9 p-0',
  'icon-xl': 'h-10 w-10 p-0',
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
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

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
