import * as React from 'react';
import {ToastViewport, type ToastItem, type ToastType, type ToastPosition} from '../components/Toast.js';

export interface ToastOptions {
  type?: ToastType;
  /** Auto-dismiss in ms (0 = manual dismiss only). */
  duration?: number;
  /** Debounced delay before showing; repeated calls with the same key reset it. */
  delay?: number;
  /** Debounce key for `delay`; defaults to the message text. */
  key?: string;
}

export interface ToastAPI {
  /** Shows a toast and returns its id (usable with `dismiss`). */
  toast: (message: string, options?: ToastOptions) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = React.createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  /** Portal target for the toast stack; defaults to document.body. */
  container?: Element | null;
  /** Oldest toasts are dropped beyond this count. */
  maxToasts?: number;
}

/** Place this high in the component tree. */
export function ToastProvider({children, position = 'top-right', container, maxToasts = 5}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const nextIdRef = React.useRef(0);
  // One timer per debounce key: delayed toasts with different keys never
  // cancel each other (a single shared timer would drop the earlier message).
  const delayTimers = React.useRef(new Map<string, number>());

  React.useEffect(
    () => () => {
      for (const timer of delayTimers.current.values()) window.clearTimeout(timer);
      delayTimers.current.clear();
    },
    [],
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = React.useCallback(
    (message: string, options: ToastOptions = {}): string => {
      const {type = 'info', duration = 5000, delay = 0, key} = options;

      const id = `toast-${++nextIdRef.current}`;
      const show = () => {
        setToasts(prev => [...prev, {id, message, type, duration}].slice(-maxToasts));
      };

      if (delay > 0) {
        const debounceKey = key ?? message;
        const existing = delayTimers.current.get(debounceKey);
        if (existing !== undefined) window.clearTimeout(existing);
        delayTimers.current.set(
          debounceKey,
          window.setTimeout(() => {
            delayTimers.current.delete(debounceKey);
            show();
          }, delay),
        );
      } else {
        show();
      }
      return id;
    },
    [maxToasts],
  );

  const api = React.useMemo<ToastAPI>(
    () => ({
      toast: addToast,
      error: msg => addToast(msg, {type: 'error', duration: 8000}),
      warning: msg => addToast(msg, {type: 'warning', duration: 6000}),
      info: msg => addToast(msg, {type: 'info'}),
      dismiss,
      clear,
    }),
    [addToast, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} position={position} container={container} />
    </ToastContext.Provider>
  );
}
