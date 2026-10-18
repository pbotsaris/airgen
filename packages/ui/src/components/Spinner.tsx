import * as React from 'react';
import {Loader} from 'lucide-react';

import {ICON_SIZES, type IconSize} from '../sizes.js';
import {Text} from './Text.js';
import {cx} from '../utils.js';

export interface SpinnerProps {
  /** Named size or pixel number. */
  size?: IconSize | number;
  className?: string;
  /** Accessible label; localize by overriding. */
  'aria-label'?: string;
}

/**
 * Indeterminate status indicator. Inherits `currentColor`; defaults to a 16px
 * icon with accessible label "Loading".
 *
 * @example
 * ```tsx
 * <Spinner size="sm" aria-label="Loading projects" />;
 * ```
 */
export function Spinner({size = 'base', className, 'aria-label': ariaLabel = 'Loading'}: SpinnerProps) {
  const pixelSize = typeof size === 'number' ? size : ICON_SIZES[size];

  return <Loader size={pixelSize} role="status" aria-label={ariaLabel} className={cx('ag-animate-spin', className)} />;
}

export interface LoadingOverlayProps {
  /** Whether async work is in flight. */
  pending: boolean;
  /** Spinner size. */
  size?: IconSize | number;
  /** Optional text beside the spinner. */
  label?: string;
  /** Delay in milliseconds before showing. @defaultValue 120 */
  delay?: number;
  className?: string;
}

/**
 * Dims its nearest positioned ancestor while `pending` and swallows pointer
 * events, so the controls underneath can't be clicked twice. The ancestor must
 * have `position: relative`. Blocks pointer interaction once visible; keyboard
 * focus is not trapped, so disable controls separately when necessary.
 *
 * @example
 * ```tsx
 * <div style={{position: 'relative'}}>
 *   <Button disabled={saving}>Save</Button>
 *   <LoadingOverlay pending={saving} label="Saving…" />
 * </div>;
 * ```
 */
export function LoadingOverlay({pending, size = 'lg', label, delay = 120, className}: LoadingOverlayProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }

    const t = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(t);
  }, [pending, delay]);

  if (!visible) return null;

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cx(
        'ag-absolute ag-inset-0 ag-z-10 ag-flex ag-items-center ag-justify-center ag-gap-2 ag-cursor-wait',
        'ag-bg-white/60 dark:ag-bg-neutral-900/60',
        'ag-animate-in ag-fade-in-0 ag-duration-200',
        className,
      )}
    >
      <Spinner size={size} className="ag-text-neutral-500 dark:ag-text-neutral-400" />
      {label && <Text variant="muted">{label}</Text>}
    </div>
  );
}
