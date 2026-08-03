import * as React from 'react';
import {CircleX, TriangleAlert, Info, X} from 'lucide-react';
import {cx} from '../utils.js';
import {Icon, type IconComponent} from './Icon.js';
import {Text} from './Text.js';
import {Button} from './Button.js';
import {Portal} from './Portal.js';

export type ToastType = 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  /** Auto-dismiss in ms (0 = manual dismiss only). */
  duration: number;
}

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

const ICONS: Record<ToastType, IconComponent> = {
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
};

const EXIT_MS = 300;

function ToastEntry({toast, onDismiss}: {toast: ToastItem; onDismiss: (id: string) => void}) {
  const [visible, setVisible] = React.useState(false);
  const exitTimer = React.useRef(0);

  React.useEffect(() => {
    // trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const t = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  React.useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const handleDismiss = () => {
    setVisible(false);
    window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => onDismiss(toast.id), EXIT_MS);
  };

  return (
    <div
      // Errors interrupt (alert announces on insertion); the polite live
      // region for the rest is the persistent viewport container below.
      role={toast.type === 'error' ? 'alert' : undefined}
      className={cx(
        'pointer-events-auto flex items-start gap-2.5 rounded-md border border-neutral-400',
        'bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-600',
        'shadow-md px-3.5 py-2.5 min-w-[280px] max-w-[400px]',
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8',
      )}
    >
      <span className="flex h-5 shrink-0 items-center">
        <Icon icon={ICONS[toast.type]} size="base" />
      </span>

      <Text className="flex-1 min-w-0 break-words">{toast.message}</Text>

      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        icon={X}
        aria-label="Dismiss"
        className="shrink-0"
        onClick={handleDismiss}
      />
    </div>
  );
}

const POSITION_CLASSES: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4 flex-col-reverse',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse',
};

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: ToastPosition;
  /** Portal target; defaults to document.body. */
  container?: Element | null;
}

/**
 * Renders active toasts in a portalled fixed stack.
 *
 * The viewport itself is ALWAYS mounted as an `aria-live` region — a live
 * region born together with its first content is skipped by most screen
 * readers, so the region must exist before any toast does.
 */
export function ToastViewport({toasts, onDismiss, position = 'top-right', container}: ToastViewportProps) {
  return (
    <Portal container={container}>
      <div
        aria-live="polite"
        aria-label="Notifications"
        className={cx('fixed z-toast flex flex-col gap-2 pointer-events-none', POSITION_CLASSES[position])}
      >
        {toasts.map(t => (
          <ToastEntry key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </Portal>
  );
}
