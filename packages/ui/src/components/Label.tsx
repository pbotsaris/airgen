import type * as React from 'react';
import {Text} from './Text.js';

export interface LabelProps {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Label({htmlFor, children, className}: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={['block ml-1 cursor-pointer', className].filter(Boolean).join(' ')}>
      <Text as="span" variant="muted" bold>
        {children}
      </Text>
    </label>
  );
}
