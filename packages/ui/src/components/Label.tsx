import type * as React from 'react';
import {Text} from './Text.js';

export interface LabelProps {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Label({htmlFor, children, className}: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={['ag-block ag-ml-1 ag-cursor-pointer', className].filter(Boolean).join(' ')}>
      <Text as="span" variant="muted" bold>
        {children}
      </Text>
    </label>
  );
}
