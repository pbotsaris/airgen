import * as React from 'react';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Merge refs (function refs or object refs). */
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): (value: T | null) => void {
  return value => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(value);
      else (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

export function useStableId(prefix = 'id'): string {
  const ref = React.useRef<string | undefined>(undefined);
  if (!ref.current) ref.current = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  return ref.current;
}

export interface ControllableStateArgs<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({value, defaultValue, onChange}: ControllableStateArgs<T>) {
  const [internal, setInternal] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const state = isControlled ? (value as T) : internal;

  const setState = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      const nextValue = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      if (!isControlled) setInternal(nextValue);
      onChange?.(nextValue);
    },
    [isControlled, onChange, state],
  );

  return [state, setState] as const;
}

/**
 * Like useControllableState, but only fires onChange on blur — not on every
 * keystroke. Keeps local state responsive while deferring the external
 * callback.
 */
export function useBlurState<T>({value, defaultValue, onChange}: ControllableStateArgs<T>) {
  const [internal, setInternal] = React.useState<T>(value ?? defaultValue);

  // sync when external value changes (e.g. after remote save)
  React.useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);

  const onBlur = React.useCallback(() => {
    setInternal(current => {
      if (current !== (value ?? defaultValue)) onChange?.(current);
      return current;
    });
  }, [value, defaultValue, onChange]);

  return {state: internal, setState: setInternal, onBlur};
}

/**
 * Tracks in-flight async work. `run` wraps a promise-returning fn and reports
 * pending while any wrapped call is outstanding.
 *
 * Counts rather than flags, so overlapping calls (a field blur landing while a
 * picker is still saving) don't have the first one to finish clear the state.
 */
export function usePending() {
  const [count, setCount] = React.useState(0);

  const run = React.useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setCount(c => c + 1);
    try {
      return await fn();
    } finally {
      setCount(c => c - 1);
    }
  }, []);

  return [count > 0, run] as const;
}

export function lockBodyScroll(locked: boolean): () => void {
  if (!locked) return () => {};
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = prevOverflow;
  };
}

export function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    "[tabindex]:not([tabindex='-1'])",
  ].join(',');

  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));

  return nodes.filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

export function trapTabKey(e: KeyboardEvent, container: HTMLElement): void {
  if (e.key !== 'Tab') return;

  const items = getFocusable(container);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (!active || active === first || !container.contains(active)) {
      e.preventDefault();
      last?.focus();
    }
  } else {
    if (!active || active === last || !container.contains(active)) {
      e.preventDefault();
      first?.focus();
    }
  }
}
