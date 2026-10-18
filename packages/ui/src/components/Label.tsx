import type * as React from 'react';
import {Text} from './Text.js';

export interface LabelProps {
  /** ID of the form control this label names. */
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Visible form label. Set `htmlFor` to the target Input or Select `id`.
 *
 * @example
 * ```tsx
 * <>
 *   <Label htmlFor="project">Project</Label>
 *   <Input id="project" />
 * </>;
 * ```
 */
export function Label({htmlFor, children, className}: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={['ag-block ag-ml-1 ag-cursor-pointer', className].filter(Boolean).join(' ')}>
      <Text as="span" variant="muted" bold>
        {children}
      </Text>
    </label>
  );
}
