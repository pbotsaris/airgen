import type * as React from 'react';
import {cx} from '../utils.js';

export type DivideDirection = 'horizontal' | 'vertical';

export interface DivideProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Separator orientation. @defaultValue 'horizontal' */
  direction?: DivideDirection;
}

/**
 * Semantic separator. Vertical separators stretch to their flex container's
 * height; horizontal separators fill the available width.
 *
 * @example
 * ```tsx
 * <Divide />;
 * <Divide direction="vertical" />;
 * ```
 */
export function Divide({direction = 'horizontal', className, ...rest}: DivideProps) {
  const isVertical = direction === 'vertical';

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cx(
        'ag-flex-none',
        isVertical
          ? 'ag-w-0 ag-self-stretch ag-border-l ag-border-neutral-200'
          : 'ag-h-0 ag-w-full ag-border-t ag-border-neutral-200',
        className,
      )}
      {...rest}
    />
  );
}
