import * as React from 'react';
import {SIZE_SCALE, type ComponentSize} from '../sizes.js';
import {airtableColorToHex} from '../colors.js';

export type TextVariant = 'heading' | 'default' | 'muted' | 'title' | 'large';

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  /** Rendered element; defaults to `h3` for heading, otherwise `p`. */
  as?: React.ElementType;
  /** Visual typography, independent of `as`. @defaultValue 'default' */
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
  title: 'ag-text-neutral-900 dark:ag-text-gray-100',
  heading: 'ag-text-neutral-900 dark:ag-text-gray-100',
  large: 'ag-text-neutral-900 dark:ag-text-gray-100',
  default: 'ag-text-neutral-900 dark:ag-text-gray-100',
  muted: 'ag-text-gray-500',
};

const VARIANT_TEXT: Record<TextVariant, string> = {
  title: 'ag-text-xl',
  heading: 'ag-text-lg',
  large: 'ag-text-base',
  default: 'ag-text-base',
  muted: 'ag-text-sm',
};

/**
 * Typography primitive that forwards its ref to the rendered element. Defaults
 * to a paragraph, or `h3` for `variant="heading"`; use `as` to choose semantics.
 *
 * @example
 * ```tsx
 * <>
 *   <Text as="h1" variant="title" bold>Projects</Text>
 *   <Text variant="muted">Choose a project to continue.</Text>
 * </>;
 * ```
 */
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
    styleClasses.push('ag-inline-flex ag-items-center', s.h, s.px, variant === undefined ? s.text : variantText);
  } else {
    styleClasses.push(variantText);
  }

  if (bold) styleClasses.push('ag-font-bold');
  if (italic) styleClasses.push('ag-italic');
  if (underline) styleClasses.push('ag-underline');
  if (className) styleClasses.push(className);

  const resolvedColor = color ? (airtableColorToHex(color) ?? color) : undefined;
  const style = resolvedColor ? {...styleProp, color: resolvedColor} : styleProp;

  const Component = (as ?? (variant === 'heading' ? 'h3' : 'p')) as React.ElementType;

  return (
    <Component ref={ref} {...rest} style={style} className={styleClasses.join(' ')}>
      {children}
    </Component>
  );
});
