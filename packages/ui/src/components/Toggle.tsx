import * as React from 'react';
import {cx} from '../utils.js';

export type ToggleSize = 'sm' | 'base';

export interface ToggleProps {
  /** Current on/off state. */
  checked: boolean;
  /** Callback when toggled. */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: ToggleSize;
  className?: string;
  /** Optional visible label. */
  label?: React.ReactNode;
}

const trackSizes: Record<ToggleSize, string> = {
  sm: 'w-7 h-4',
  base: 'w-9 h-5',
};

const thumbSizes: Record<ToggleSize, string> = {
  sm: 'h-3 w-3',
  base: 'h-4 w-4',
};

const thumbTranslate: Record<ToggleSize, string> = {
  sm: 'translate-x-3',
  base: 'translate-x-4',
};

/** Classic sliding toggle switch with a rounded thumb. */
export function Toggle({checked, onChange, disabled = false, size = 'base', className, label}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) onChange(!checked);
  };

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={cx(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
        trackSizes[size],
        checked ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-600',
        disabled && 'opacity-50 cursor-not-allowed',
        !label && className,
      )}
    >
      <span
        className={cx(
          'inline-block rounded-full bg-white shadow transform transition-transform duration-150',
          thumbSizes[size],
          checked ? thumbTranslate[size] : 'translate-x-0.5',
        )}
      />
    </button>
  );

  if (label) {
    return (
      <label className={cx('inline-flex items-center gap-2', className)}>
        {track}
        <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      </label>
    );
  }

  return track;
}
