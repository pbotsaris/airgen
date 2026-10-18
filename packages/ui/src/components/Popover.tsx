import * as React from 'react';
import {Portal} from './Portal.js';
import {cx, mergeRefs, trapTabKey, useStableId} from '../utils.js';
import {usePresence} from '../dropdown.js';
import {useAnchoredPosition, type Side, type Align} from '../positioning.js';
import {getElementRef} from '../slot.js';

const EXIT_MS = 150; // matches tailwindcss-animate's default animate-out duration

interface PopoverContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
  setContentId: (id: string) => void;
  side: Side;
  align: Align;
  offset: number;
  portal: boolean;
  trapFocus: boolean;
  avoidCollisions: boolean;
  collisionPadding: number;
  flip: boolean;
}

const PopoverCtx = React.createContext<PopoverContextValue | null>(null);

function usePopoverCtx(name: string): PopoverContextValue {
  const ctx = React.useContext(PopoverCtx);
  if (!ctx) throw new Error(`${name} must be used within <Popover>`);
  return ctx;
}

export interface PopoverProps {
  children?: React.ReactNode;
  /** Controlled visibility; pair with `onOpenChange`. */
  open?: boolean;
  /** Initial visibility in uncontrolled mode. @defaultValue false */
  defaultOpen?: boolean;
  /** Called when visibility changes, including in controlled mode. */
  onOpenChange?: (open: boolean) => void;
  /** Preferred side of the trigger. @defaultValue 'bottom' */
  side?: Side;
  /** Alignment along the trigger edge. @defaultValue 'center' */
  align?: Align;
  /** Gap from the trigger in pixels. @defaultValue 8 */
  offset?: number;
  /** Mount content in document.body through Portal. @defaultValue true */
  portal?: boolean;
  /** Keep Tab navigation inside the open content. @defaultValue false */
  trapFocus?: boolean;
  /** Shift content to stay within the viewport. @defaultValue true */
  avoidCollisions?: boolean;
  /** Minimum viewport edge spacing in pixels. @defaultValue 8 */
  collisionPadding?: number;
  /** Flip to the opposite side when the content would overflow the viewport. */
  flip?: boolean;
}

/**
 * Popover root. Provides Trigger/Content/Close as compound components
 * (`Popover.Trigger` statics and named exports both work). Escape and outside
 * pointer interaction close the popover. Trigger children must accept a ref
 * and forward event handlers and ARIA attributes to a DOM element.
 *
 * @example
 * ```tsx
 * <Popover align="start">
 *   <Popover.Trigger><Button type="button">Details</Button></Popover.Trigger>
 *   <Popover.Content aria-label="Project details">
 *     <Text>Project settings</Text>
 *     <Popover.Close><Button type="button">Done</Button></Popover.Close>
 *   </Popover.Content>
 * </Popover>;
 * ```
 */
export function Popover({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = 'bottom',
  align = 'center',
  offset = 8,
  portal = true,
  trapFocus = false,
  avoidCollisions = true,
  collisionPadding = 8,
  flip = false,
}: PopoverProps) {
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

  const toggle = React.useCallback(() => setOpen(!open), [open, setOpen]);

  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // A consumer id passed to Popover.Content registers here so the trigger's
  // aria-controls always matches the actual content id.
  const defaultContentId = useStableId('popover');
  const [contentId, setContentId] = React.useState(defaultContentId);

  const ctxValue = React.useMemo<PopoverContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      triggerRef,
      contentRef,
      contentId,
      setContentId,
      side,
      align,
      offset,
      portal,
      trapFocus,
      avoidCollisions,
      collisionPadding,
      flip,
    }),
    [open, setOpen, toggle, contentId, side, align, offset, portal, trapFocus, avoidCollisions, collisionPadding, flip],
  );

  return <PopoverCtx.Provider value={ctxValue}>{children}</PopoverCtx.Provider>;
}

export interface PopoverTriggerProps extends React.HTMLAttributes<HTMLElement> {
  /** A single element child; handlers, ARIA and the anchor ref are cloned onto it. */
  children: React.ReactElement;
}

/**
 * Clones open/close handlers, ARIA attributes, and an anchor ref onto one
 * child element. Must be inside Popover.
 *
 * @example
 * ```tsx
 * <Popover.Trigger><Button type="button">Open</Button></Popover.Trigger>;
 * ```
 */
export function PopoverTrigger({children, ...rest}: PopoverTriggerProps) {
  const ctx = usePopoverCtx('Popover.Trigger');

  if (!React.isValidElement(children)) {
    throw new Error('Popover.Trigger expects a single React element child.');
  }

  const childProps = (children.props ?? {}) as React.HTMLAttributes<HTMLElement>;
  const onClickChild = childProps.onClick;
  const onClickUser = rest.onClick;

  return React.cloneElement(children, {
    ...rest,
    'aria-haspopup': 'dialog',
    'aria-expanded': ctx.open,
    'aria-controls': ctx.open ? ctx.contentId : undefined,
    'data-state': ctx.open ? 'open' : 'closed',
    ref: mergeRefs(getElementRef(children) as React.Ref<HTMLElement>, ctx.triggerRef),
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      onClickChild?.(e);
      onClickUser?.(e);
      if (e.defaultPrevented) return;
      ctx.toggle();
    },
  } as React.HTMLAttributes<HTMLElement> & {ref: React.Ref<HTMLElement>});
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Called before Escape closes the popover; `preventDefault()` cancels closing. */
  onEscapeKeyDown?: (ev: KeyboardEvent) => void;
  /** Called before an outside pointer press closes it; `preventDefault()` cancels closing. */
  onInteractOutside?: (ev: PointerEvent) => void;
}

/**
 * Anchored dialog surface inside Popover. Portalled by default; provide
 * `aria-label` or `aria-labelledby` to name it.
 *
 * @example
 * ```tsx
 * <Popover.Content aria-label="Details"><Text>Project details</Text></Popover.Content>;
 * ```
 */
export function PopoverContent({
  id,
  className = '',
  style,
  onEscapeKeyDown,
  onInteractOutside,
  ...rest
}: PopoverContentProps) {
  const ctx = usePopoverCtx('Popover.Content');
  const present = usePresence(ctx.open, EXIT_MS);

  // A consumer-supplied id becomes THE content id (trigger aria-controls
  // follows via context) instead of silently diverging.
  React.useEffect(() => {
    if (id && id !== ctx.contentId) ctx.setContentId(id);
  }, [id, ctx]);
  const contentId = id ?? ctx.contentId;

  const {
    style: posStyle,
    ready,
    contentRefCallback,
  } = useAnchoredPosition({
    open: ctx.open,
    anchorRef: ctx.triggerRef,
    contentRef: ctx.contentRef,
    side: ctx.side,
    align: ctx.align,
    offset: ctx.offset,
    collisionPadding: ctx.collisionPadding,
    avoidCollisions: ctx.avoidCollisions,
    flip: ctx.flip,
  });

  // Outside click + Escape
  React.useEffect(() => {
    if (!ctx.open) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      onEscapeKeyDown?.(ev);
      if (ev.defaultPrevented) return;
      ctx.setOpen(false);
    };

    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      const contentEl = ctx.contentRef.current;
      const triggerEl = ctx.triggerRef.current;
      if (!target || !contentEl || !triggerEl) return;

      if (!contentEl.contains(target) && !triggerEl.contains(target)) {
        onInteractOutside?.(ev);
        if (ev.defaultPrevented) return;
        ctx.setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [ctx, onEscapeKeyDown, onInteractOutside]);

  // Focus management: focus first focusable on open; restore to the trigger
  // only on a real open -> closed transition (not on unrelated effect re-runs).
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (ctx.open && !wasOpen.current) {
      queueMicrotask(() => {
        const el = ctx.contentRef.current;
        if (!el) return;
        const first = el.querySelector<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        (first ?? el).focus?.();
      });
    } else if (!ctx.open && wasOpen.current) {
      ctx.triggerRef.current?.focus?.();
    }
    wasOpen.current = ctx.open;
  }, [ctx.open, ctx.contentRef, ctx.triggerRef]);

  // Optional focus trap, scoped to the content element.
  React.useEffect(() => {
    if (!ctx.open || !ctx.trapFocus) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      const el = ctx.contentRef.current;
      if (el) trapTabKey(ev, el);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [ctx.open, ctx.trapFocus, ctx.contentRef]);

  if (!present) return null;

  const node = (
    <div
      {...rest}
      id={contentId}
      role="dialog"
      tabIndex={-1}
      data-state={ctx.open ? 'open' : 'closed'}
      ref={contentRefCallback}
      className={cx(
        'ag-z-popover ag-rounded-md ag-border ag-border-neutral-200 ag-bg-white ag-p-4 ag-text-neutral-900 ag-shadow-md ag-outline-none',
        'dark:ag-border-neutral-600 dark:ag-bg-neutral-800 dark:ag-text-neutral-100',
        'data-[state=open]:ag-animate-in data-[state=closed]:ag-animate-out',
        'data-[state=open]:ag-fade-in data-[state=closed]:ag-fade-out',
        'data-[state=open]:ag-zoom-in data-[state=closed]:ag-zoom-out',
        className,
      )}
      style={{
        ...posStyle,
        visibility: ready ? undefined : 'hidden',
        ...style,
      }}
    />
  );

  return ctx.portal ? <Portal>{node}</Portal> : node;
}

export interface PopoverCloseProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement;
}

/**
 * Clones a close handler onto one child inside Popover. Child or user click
 * handlers can call `preventDefault()` to cancel closing.
 *
 * @example
 * ```tsx
 * <Popover.Close><Button type="button">Done</Button></Popover.Close>;
 * ```
 */
export function PopoverClose({children, ...rest}: PopoverCloseProps) {
  const ctx = usePopoverCtx('Popover.Close');

  if (!React.isValidElement(children)) {
    throw new Error('Popover.Close expects a single React element child.');
  }

  const childProps = (children.props ?? {}) as React.HTMLAttributes<HTMLElement>;
  const onClickChild = childProps.onClick;
  const onClickUser = rest.onClick;

  return React.cloneElement(children, {
    ...rest,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      onClickChild?.(e);
      onClickUser?.(e);
      if (e.defaultPrevented) return;
      ctx.setOpen(false);
    },
  } as React.HTMLAttributes<HTMLElement>);
}

Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;
Popover.Close = PopoverClose;
