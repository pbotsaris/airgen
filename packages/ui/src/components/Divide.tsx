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
