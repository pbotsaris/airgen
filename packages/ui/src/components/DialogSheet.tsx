import * as React from 'react';
import {Portal} from './Portal.js';
import {cx, useStableId, useControllableState, trapTabKey, lockBodyScroll, getFocusable} from '../utils.js';
import {usePresence} from '../dropdown.js';
import {getElementRef} from '../slot.js';

interface DialogCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
  /** Title/Description register on mount so Content only emits the ARIA
   * references when the elements actually exist (no dangling IDREFs). */
  hasTitle: boolean;
  setHasTitle: (v: boolean) => void;
  hasDescription: boolean;
  setHasDescription: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  durationMs: number;
}

const DialogContext = React.createContext<DialogCtx | null>(null);

function useDialogCtx(name: string): DialogCtx {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error(`${name} must be used inside <Dialog.Root>`);
  return ctx;
}

export interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  /** Exit-animation hold; must match the content's CSS duration. */
  durationMs?: number;
}

function DialogRoot({open, defaultOpen, onOpenChange, children, durationMs = 200}: DialogRootProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen ?? false,
    onChange: onOpenChange,
  });

  const contentId = useStableId('dialog-content');
  const titleId = useStableId('dialog-title');
  const descriptionId = useStableId('dialog-desc');
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [hasTitle, setHasTitle] = React.useState(false);
  const [hasDescription, setHasDescription] = React.useState(false);

  const ctx = React.useMemo<DialogCtx>(
    () => ({
      open: isOpen,
      setOpen: v => setIsOpen(v),
      contentId,
      titleId,
      descriptionId,
      hasTitle,
      setHasTitle,
      hasDescription,
      setHasDescription,
      triggerRef,
      durationMs,
    }),
    [isOpen, setIsOpen, contentId, titleId, descriptionId, hasTitle, hasDescription, durationMs],
  );

  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>;
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Clone onto the element child instead of rendering a button. */
  asChild?: boolean;
  children?: React.ReactNode;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(function DialogTrigger(
  {asChild = false, children, ...props},
  ref,
) {
  const ctx = useDialogCtx('Dialog.Trigger');

  const setTriggerRef = (node: HTMLButtonElement | null) => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
    // cast: RefObject.current is typed readonly under @types/react@17
    (ctx.triggerRef as {current: HTMLElement | null}).current = node;
  };

  const injected: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    ...props,
    type: props.type ?? 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': ctx.open,
    'aria-controls': ctx.open ? ctx.contentId : undefined,
    onClick: e => {
      props.onClick?.(e);
      if (!e.defaultPrevented) ctx.setOpen(!ctx.open);
    },
  };

  if (!asChild) {
    return (
      <button {...injected} ref={setTriggerRef}>
        {children}
      </button>
    );
  }

  // Find the first *element* child (ignore strings, numbers, etc.)
  let el: React.ReactElement | null = null;
  React.Children.forEach(children, c => {
    if (el) return;
    if (React.isValidElement(c)) el = c;
  });

  if (!el) {
    throw new Error('Dialog.Trigger `asChild` expects a React element child (e.g. <Button />).');
  }
  const element = el as React.ReactElement;
  const elementProps = (element.props ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>;

  const mergedOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    elementProps.onClick?.(e);
    injected.onClick?.(e);
  };

  const mergedRef = (node: HTMLButtonElement | null) => {
    const childRef = getElementRef(element);
    if (typeof childRef === 'function') childRef(node);
    else if (childRef && typeof childRef === 'object') (childRef as {current: HTMLButtonElement | null}).current = node;
    setTriggerRef(node);
  };

  return React.cloneElement(element, {
    ...injected,
    ...elementProps,
    // ensure ARIA wins
    'aria-haspopup': 'dialog',
    'aria-expanded': ctx.open,
    'aria-controls': ctx.open ? ctx.contentId : undefined,
    type: elementProps.type ?? injected.type,
    onClick: mergedOnClick,
    ref: mergedRef,
  } as React.ButtonHTMLAttributes<HTMLButtonElement> & {ref: React.Ref<HTMLButtonElement>});
});

export interface DialogPortalProps {
  children?: React.ReactNode;
  container?: Element | DocumentFragment | null;
}

function DialogPortal({children, container}: DialogPortalProps) {
  const ctx = useDialogCtx('Dialog.Portal');
  const present = usePresence(ctx.open, ctx.durationMs);
  if (!present) return null;
  return <Portal container={container}>{children}</Portal>;
}

function DialogOverlay({className, ...props}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useDialogCtx('Dialog.Overlay');

  const base =
    'fixed inset-0 z-overlay bg-black/50 ' +
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 ' +
    'duration-200 ' +
    'data-[state=closed]:opacity-0'; // Keep overlay invisible when closed

  return (
    <div
      {...props}
      data-state={ctx.open ? 'open' : 'closed'}
      className={cx(base, className)}
      onClick={e => {
        props.onClick?.(e);
        if (!e.defaultPrevented && e.target === e.currentTarget) ctx.setOpen(false);
      }}
    />
  );
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  lockScroll?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  {className, initialFocusRef, closeOnEscape = true, trapFocus: shouldTrapFocus = true, restoreFocus = true, lockScroll = true, ...props},
  ref,
) {
  const ctx = useDialogCtx('Dialog.Content');
  const localRef = React.useRef<HTMLDivElement | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  React.useEffect(() => {
    if (!ctx.open) return;

    const restoreScroll = lockScroll ? lockBodyScroll(true) : () => {};
    const prevActive = document.activeElement as HTMLElement | null;

    queueMicrotask(() => {
      const node = localRef.current;
      if (!node) return;
      const candidate = initialFocusRef?.current || getFocusable(node)[0] || node;
      candidate.focus?.();
    });

    // Attached to the content node, NOT document: nested dialogs portal to
    // separate body subtrees, so only the dialog containing the focused
    // element receives the Escape — one press closes one dialog.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!ctx.open) return;
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        ctx.setOpen(false);
        return;
      }
      if (shouldTrapFocus) {
        const node = localRef.current;
        if (node) trapTabKey(e, node);
      }
    };

    const node = localRef.current;
    node?.addEventListener('keydown', onKeyDown);

    return () => {
      node?.removeEventListener('keydown', onKeyDown);
      restoreScroll();

      if (restoreFocus) {
        queueMicrotask(() => {
          const t = ctx.triggerRef.current;
          if (t && document.contains(t)) t.focus();
          else prevActive?.focus?.();
        });
      }
    };
  }, [ctx, closeOnEscape, shouldTrapFocus, restoreFocus, lockScroll, initialFocusRef]);

  const base =
    'fixed z-overlay outline-none ' +
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ' +
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 ' +
    'duration-200';

  return (
    <div
      {...props}
      ref={setRef}
      role="dialog"
      aria-modal="true"
      id={ctx.contentId}
      aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
      aria-describedby={ctx.hasDescription ? ctx.descriptionId : undefined}
      tabIndex={-1}
      data-state={ctx.open ? 'open' : 'closed'}
      className={cx(base, className)}
    />
  );
});

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function DialogTitle(
  {className, ...props},
  ref,
) {
  const ctx = useDialogCtx('Dialog.Title');
  React.useEffect(() => {
    ctx.setHasTitle(true);
    return () => ctx.setHasTitle(false);
  }, [ctx]);
  return <h2 {...props} ref={ref} id={ctx.titleId} className={className} />;
});

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function DialogDescription({className, ...props}, ref) {
    const ctx = useDialogCtx('Dialog.Description');
    React.useEffect(() => {
      ctx.setHasDescription(true);
      return () => ctx.setHasDescription(false);
    }, [ctx]);
    return <p {...props} ref={ref} id={ctx.descriptionId} className={className} />;
  },
);

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children?: React.ReactNode;
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(function DialogClose(
  {asChild = false, children, ...props},
  ref,
) {
  const ctx = useDialogCtx('Dialog.Close');

  const setCloseRef = (node: HTMLButtonElement | null) => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const injected: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    ...props,
    type: props.type ?? 'button',
    onClick: e => {
      props.onClick?.(e);
      if (!e.defaultPrevented) ctx.setOpen(false);
    },
  };

  if (!asChild) {
    return (
      <button {...injected} ref={setCloseRef}>
        {children}
      </button>
    );
  }

  let el: React.ReactElement | null = null;
  React.Children.forEach(children, c => {
    if (el) return;
    if (React.isValidElement(c)) el = c;
  });

  if (!el) {
    throw new Error('Dialog.Close `asChild` expects a React element child (e.g. <Button />).');
  }
  const element = el as React.ReactElement;
  const elementProps = (element.props ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>;

  const mergedOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    elementProps.onClick?.(e);
    injected.onClick?.(e);
  };

  const mergedRef = (node: HTMLButtonElement | null) => {
    const childRef = getElementRef(element);
    if (typeof childRef === 'function') childRef(node);
    else if (childRef && typeof childRef === 'object') (childRef as {current: HTMLButtonElement | null}).current = node;
    setCloseRef(node);
  };

  return React.cloneElement(element, {
    ...injected,
    ...elementProps,
    type: elementProps.type ?? injected.type,
    onClick: mergedOnClick,
    ref: mergedRef,
  } as React.ButtonHTMLAttributes<HTMLButtonElement> & {ref: React.Ref<HTMLButtonElement>});
});

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
};

/* -------------------------------------------------------------------------------------------------
 * Sheet (Dialog with side positioning + slide animations)
 * -----------------------------------------------------------------------------------------------*/

export type SheetSide = 'right' | 'left' | 'top' | 'bottom';

export interface SheetContentProps extends DialogContentProps {
  side?: SheetSide;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(function SheetContent(
  {side = 'right', restoreFocus = true, className, ...props},
  ref,
) {
  const sideClasses: Record<SheetSide, string> = {
    right:
      'inset-y-0 right-0 h-full w-80 md:w-96 border-l ' +
      'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right ' +
      'data-[state=closed]:translate-x-full',
    left:
      'inset-y-0 left-0 h-full w-80 md:w-96 border-r ' +
      'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left ' +
      'data-[state=closed]:-translate-x-full',
    top:
      'inset-x-0 top-0 w-full h-1/3 md:h-1/2 border-t-0 border-b ' +
      'data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top ' +
      'data-[state=closed]:-translate-y-full',
    bottom:
      'inset-x-0 bottom-0 w-full h-1/3 md:h-1/2 border-t ' +
      'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom ' +
      'data-[state=closed]:translate-y-full',
  };

  const base =
    // bg must be a real color: the package's Tailwind theme has no
    // `bg-background`-style CSS-variable token.
    'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-600 shadow-lg ' +
    'data-[state=open]:animate-in data-[state=closed]:animate-out duration-200 ' +
    'data-[state=closed]:opacity-0'; // Keep it invisible when closed

  return <DialogContent {...props} ref={ref} className={cx(base, sideClasses[side], className)} restoreFocus={restoreFocus} />;
});

export const Sheet = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
  Content: SheetContent,
};
