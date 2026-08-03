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

/** Indeterminate spinner. Inherits `currentColor`, so callers set the color. */
export function Spinner({size = 'base', className, 'aria-label': ariaLabel = 'Loading'}: SpinnerProps) {
  const pixelSize = typeof size === 'number' ? size : ICON_SIZES[size];

  return <Loader size={pixelSize} role="status" aria-label={ariaLabel} className={cx('animate-spin', className)} />;
}

export interface LoadingOverlayProps {
  /** Whether async work is in flight. */
  pending: boolean;
  /** Spinner size. */
  size?: IconSize | number;
  /** Optional text beside the spinner. */
  label?: string;
  /** Wait this long before showing, so quick work doesn't flash a spinner. */
  delay?: number;
  className?: string;
}

/**
 * Dims its nearest positioned ancestor while `pending` and swallows pointer
 * events, so the controls underneath can't be clicked twice. The ancestor must
 * be `relative`.
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
        'absolute inset-0 z-10 flex items-center justify-center gap-2 cursor-wait',
        'bg-white/60 dark:bg-neutral-900/60',
        'animate-in fade-in-0 duration-200',
        className,
      )}
    >
      <Spinner size={size} className="text-neutral-500 dark:text-neutral-400" />
      {label && <Text variant="muted">{label}</Text>}
    </div>
  );
}
