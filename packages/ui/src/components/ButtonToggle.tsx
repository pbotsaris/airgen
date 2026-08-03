import {Button, type ButtonSize, type ButtonVariant} from './Button.js';
import type {IconComponent} from './Icon.js';
import type {SelectOption} from '../types.js';

export interface ButtonToggleProps {
  /** Options for the toggle (multi-option mode). */
  options?: SelectOption[];
  /** Currently selected value (multi-option mode). */
  value?: string;
  /** Current checked state (boolean mode). */
  checked?: boolean;
  /** Custom label content for boolean mode. */
  children?: React.ReactNode;
  /** A lucide-react icon component (optional). */
  icon?: IconComponent;
  /** Callback when value changes. */
  onChange: (newValue: string | boolean) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * A button that toggles between multiple options when clicked.
 * Supports two modes:
 * - **Multi-option**: pass `options` and `value` to cycle through options
 * - **Boolean**: pass `checked` (and optional `children`/`icon`) for on/off toggle
 *
 * Invalid input warns and renders null rather than throwing.
 */
export function ButtonToggle({
  options,
  value,
  onChange,
  children,
  checked,
  icon,
  variant = 'outline',
  size = 'sm',
  className = '',
}: ButtonToggleProps) {
  if (checked != null) {
    const handleClick = () => onChange(!checked);
    const label = children ?? (checked ? 'On' : 'Off');

    return (
      <Button variant={variant} size={size} className={className} onClick={handleClick} icon={icon} aria-pressed={checked}>
        {label}
      </Button>
    );
  }

  // Multi-option toggle mode
  if (!Array.isArray(options)) {
    console.warn(`ButtonToggle: options ${JSON.stringify(options)} is not an array`);
    return null;
  }

  if (options.length === 0) {
    console.warn('ButtonToggle: no options provided');
    return null;
  }

  const optionValues = options.map(opt => opt.value);
  const currentLabel = options.find(opt => opt.value === value)?.label;

  if (value === undefined || !optionValues.includes(value)) {
    console.warn(`ButtonToggle: value '${value}' not in options '${JSON.stringify(options)}'`);
    return null;
  }

  const handleClick = () => {
    const currentIndex = optionValues.indexOf(value);
    const nextIndex = (currentIndex + 1) % optionValues.length;
    const nextValue = optionValues[nextIndex];
    onChange(nextValue);
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick} icon={icon}>
      {currentLabel}
    </Button>
  );
}
