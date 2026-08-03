import type * as React from 'react';
import {cx} from '../utils.js';

export type DivideDirection = 'horizontal' | 'vertical';

export interface DivideProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: DivideDirection;
}

export function Divide({direction = 'horizontal', className, ...rest}: DivideProps) {
  const isVertical = direction === 'vertical';

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cx(
        'flex-none',
        isVertical
          ? 'w-0 self-stretch border-l border-neutral-200'
          : 'h-0 w-full border-t border-neutral-200',
        className,
      )}
      {...rest}
    />
  );
}
