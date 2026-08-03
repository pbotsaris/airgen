import * as React from 'react';
import {Portal} from './Portal.js';
import {cx, mergeRefs, useStableId} from '../utils.js';
import {useAnchoredPosition, type Side, type Align} from '../positioning.js';
import {getElementRef} from '../slot.js';

interface TooltipContextValue {
  open: boolean;
  scheduleOpen: () => void;
  closeNow: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
  disableHoverableContent: boolean;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipCtx(name: string): TooltipContextValue {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error(`${name} must be used within <Tooltip>`);
  return ctx;
}

export interface TooltipProps {
  children?: React.ReactNode;
  /** Hover delay before opening, in ms. */
  delay?: number;
  /** When true (default) the content ignores pointer events. */
  disableHoverableContent?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Tooltip({
  children,
  delay = 250,
  disableHoverableContent = true,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? !!openProp : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const openTimerRef = React.useRef(0);
  const contentId = useStableId('tooltip');

  const scheduleOpen = React.useCallback(() => {
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay, setOpen]);

  const closeNow = React.useCallback(() => {
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = 0;
    setOpen(false);
  }, [setOpen]);

  React.useEffect(() => () => window.clearTimeout(openTimerRef.current), []);

  const value = React.useMemo(
    () => ({open, scheduleOpen, closeNow, triggerRef, contentRef, contentId, disableHoverableContent}),
    [open, scheduleOpen, closeNow, contentId, disableHoverableContent],
  );

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
}

export interface TooltipTriggerProps {
  children: React.ReactNode;
  /**
   * Clone handlers/ref/aria-describedby onto the child element instead of
   * wrapping it in a span — use for interactive children (buttons, inputs)
   * so the description lands on the focusable element itself.
   */
  asChild?: boolean;
}

export function TooltipTrigger({children, asChild = false}: TooltipTriggerProps) {
  const ctx = useTooltipCtx('TooltipTrigger');
  const {triggerRef, scheduleOpen, closeNow, open, contentId} = ctx;

  const describedBy = open ? contentId : undefined;

  if (asChild && React.isValidElement(children)) {
    const childProps = (children.props ?? {}) as React.HTMLAttributes<HTMLElement>;
    return React.cloneElement(children, {
      'aria-describedby': describedBy,
      ref: mergeRefs(getElementRef(children) as React.Ref<HTMLElement>, triggerRef),
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        childProps.onPointerEnter?.(e);
        scheduleOpen();
      },
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
        childProps.onPointerLeave?.(e);
        closeNow();
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        childProps.onFocus?.(e);
        scheduleOpen();
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        childProps.onBlur?.(e);
        closeNow();
      },
    } as React.HTMLAttributes<HTMLElement> & {ref: React.Ref<HTMLElement>});
  }

  // Wrap in a span that *always* can take a ref.
  return (
    <span
      // cast: @types/react@17 wants a non-nullable RefObject in ref position
      ref={triggerRef as React.RefObject<HTMLSpanElement>}
      aria-describedby={describedBy}
      onPointerEnter={scheduleOpen}
      onPointerLeave={closeNow}
      onFocus={scheduleOpen}
      onBlur={closeNow}
      className="inline-flex"
    >
      {children}
    </span>
  );
}

export interface TooltipContentProps {
  children?: React.ReactNode;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  className?: string;
}

export function TooltipContent({children, side = 'top', align = 'center', sideOffset = 8, className = ''}: TooltipContentProps) {
  const ctx = useTooltipCtx('TooltipContent');
  const {open, closeNow, triggerRef, contentRef, contentId, disableHoverableContent} = ctx;

  const {style, ready, contentRefCallback} = useAnchoredPosition({
    open,
    anchorRef: triggerRef,
    contentRef,
    side,
    align,
    offset: sideOffset,
    collisionPadding: 8,
  });

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && closeNow();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeNow]);

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={contentRefCallback}
        id={contentId}
        role="tooltip"
        className={cx(
          'fixed z-tooltip rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 shadow-md',
          'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100',
          className,
        )}
        style={{
          ...style,
          opacity: ready ? 1 : 0,
          pointerEvents: disableHoverableContent ? 'none' : 'auto',
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

Tooltip.Trigger = TooltipTrigger;
Tooltip.Content = TooltipContent;
