import * as React from 'react';
import {SIZE_SCALE, type ComponentSize} from '../sizes.js';
import {airtableColorToHex} from '../colors.js';

export type TextVariant = 'heading' | 'default' | 'muted' | 'title' | 'large';

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  as?: React.ElementType;
  variant?: TextVariant;
  /**
   * Sizes the text box like a control of this size (same height and
   * horizontal padding as Button/Input, content vertically centered). The
   * control's text size applies unless an explicit `variant` is passed.
   */
  padAs?: ComponentSize;
  /** Airtable color name, CSS hex, or any CSS color. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const VARIANT_COLOR: Record<TextVariant, string> = {
  title: 'text-neutral-900 dark:text-gray-100',
  heading: 'text-neutral-900 dark:text-gray-100',
  large: 'text-neutral-900 dark:text-gray-100',
  default: 'text-neutral-900 dark:text-gray-100',
  muted: 'text-gray-500',
};

const VARIANT_TEXT: Record<TextVariant, string> = {
  title: 'text-xl',
  heading: 'text-lg',
  large: 'text-base',
  default: 'text-base',
  muted: 'text-sm',
};

export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  {
    as,
    variant,
    padAs,
    color,
    className,
    style: styleProp,
    bold = false,
    italic = false,
    underline = false,
    children,
    ...rest
  },
  ref,
) {
  const variantKey = variant ?? 'default';
  const variantText = VARIANT_TEXT[variantKey] || VARIANT_TEXT.default;
  const styleClasses = [VARIANT_COLOR[variantKey] || VARIANT_COLOR.default];

  if (padAs) {
    const s = SIZE_SCALE[padAs] || SIZE_SCALE.base;
    // Explicit variant wins over the control size's text class.
    styleClasses.push('inline-flex items-center', s.h, s.px, variant === undefined ? s.text : variantText);
  } else {
    styleClasses.push(variantText);
  }

  if (bold) styleClasses.push('font-bold');
  if (italic) styleClasses.push('italic');
  if (underline) styleClasses.push('underline');
  if (className) styleClasses.push(className);

  const resolvedColor = color ? airtableColorToHex(color) ?? color : undefined;
  const style = resolvedColor ? {...styleProp, color: resolvedColor} : styleProp;

  const Component = (as ?? (variant === 'heading' ? 'h3' : 'p')) as React.ElementType;

  return (
    <Component ref={ref} {...rest} style={style} className={styleClasses.join(' ')}>
      {children}
    </Component>
  );
});
