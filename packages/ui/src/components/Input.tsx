import * as React from 'react';
import {cx, useControllableState} from '../utils.js';
import {controlSizeClasses, type ComponentSize} from '../sizes.js';

export type InputVariant = 'default' | 'ghost';

const VARIANT_BASE =
  'ag-rounded-md ag-transition-[border-color,background-color,box-shadow] ag-duration-150 dark:ag-text-neutral-100';

const VARIANT: Record<InputVariant, string> = {
  default: `${VARIANT_BASE} ag-border ag-border-neutral-200 ag-bg-transparent focus:ag-bg-neutral-100 dark:ag-bg-neutral-800 dark:ag-border-neutral-600 dark:focus:ag-bg-neutral-700`,
  ghost: `${VARIANT_BASE} ag-border ag-border-transparent ag-bg-transparent hover:ag-border-neutral-200 focus:ag-border-neutral-200 focus:ag-bg-neutral-100 dark:hover:ag-border-neutral-600 dark:focus:ag-border-neutral-600 dark:focus:ag-bg-neutral-700`,
};

function variantClasses(variant: InputVariant, {disabled}: {disabled?: boolean} = {}) {
  return cx(VARIANT[variant], disabled && 'ag-opacity-60 ag-cursor-not-allowed');
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue' | 'size'> {
  variant?: InputVariant;
  /** Shared control size (shadows the native `size` char-width attribute). */
  size?: ComponentSize;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  const {variant = 'default', size = 'base', value, defaultValue = '', onChange, className, ...rest} = props;

  const [state, setState] = useControllableState({value, defaultValue, onChange});

  return (
    <input
      ref={ref}
      type="text"
      value={state}
      onChange={e => setState(e.target.value)}
      className={cx(
        'ag-w-full ag-outline-none',
        controlSizeClasses(size),
        variantClasses(variant, {disabled: rest.disabled}),
        className,
      )}
      {...rest}
    />
  );
});
