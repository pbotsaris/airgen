import * as React from 'react';
import {cx, useControllableState} from '../utils.js';
import {controlSizeClasses, type ComponentSize} from '../sizes.js';

export type InputVariant = 'default' | 'ghost';

const VARIANT_BASE =
  'rounded-md transition-[border-color,background-color,box-shadow] duration-150 dark:text-neutral-100';

const VARIANT: Record<InputVariant, string> = {
  default: `${VARIANT_BASE} border border-neutral-200 bg-transparent focus:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-600 dark:focus:bg-neutral-700`,
  ghost: `${VARIANT_BASE} border border-transparent bg-transparent hover:border-neutral-200 focus:border-neutral-200 focus:bg-neutral-100 dark:hover:border-neutral-600 dark:focus:border-neutral-600 dark:focus:bg-neutral-700`,
};

function variantClasses(variant: InputVariant, {disabled}: {disabled?: boolean} = {}) {
  return cx(VARIANT[variant], disabled && 'opacity-60 cursor-not-allowed');
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
        'w-full outline-none',
        controlSizeClasses(size),
        variantClasses(variant, {disabled: rest.disabled}),
        className,
      )}
      {...rest}
    />
  );
});
