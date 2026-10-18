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
  sm: 'ag-w-7 ag-h-4',
  base: 'ag-w-9 ag-h-5',
};

const thumbSizes: Record<ToggleSize, string> = {
  sm: 'ag-h-3 ag-w-3',
  base: 'ag-h-4 ag-w-4',
};

const thumbTranslate: Record<ToggleSize, string> = {
  sm: 'ag-translate-x-3',
  base: 'ag-translate-x-4',
};

/**
 * Controlled switch. Update `checked` in `onChange`; use `label` to provide
 * a visible, accessible name.
 *
 * @example
 * ```tsx
 * const [enabled, setEnabled] = useState(false);
 * <Toggle checked={enabled} onChange={setEnabled} label="Notifications" />;
 * ```
 */
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
        'ag-relative ag-inline-flex ag-shrink-0 ag-cursor-pointer ag-items-center ag-rounded-full ag-transition-colors ag-duration-150',
        trackSizes[size],
        checked ? 'ag-bg-blue-600' : 'ag-bg-neutral-300 dark:ag-bg-neutral-600',
        disabled && 'ag-opacity-50 ag-cursor-not-allowed',
        !label && className,
      )}
    >
      <span
        className={cx(
          'ag-inline-block ag-rounded-full ag-bg-white ag-shadow ag-transform ag-transition-transform ag-duration-150',
          thumbSizes[size],
          checked ? thumbTranslate[size] : 'ag-translate-x-0.5',
        )}
      />
    </button>
  );

  if (label) {
    return (
      <label className={cx('ag-inline-flex ag-items-center ag-gap-2', className)}>
        {track}
        <span className="ag-text-sm ag-text-neutral-700 dark:ag-text-neutral-300">{label}</span>
      </label>
    );
  }

  return track;
}
