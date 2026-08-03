import * as React from 'react';

/**
 * Shared mechanics for anchored dropdown menus (Select, RecordSelect).
 *
 * Each hook owns one concern so components compose only what they need:
 * open-state + notifications (`useDropdownState`) and outside-click dismissal
 * (`useOutsideDismiss`). Positioning lives in `positioning.ts`.
 */

/** Close-animation duration shared by usePresence consumers. */
export const DROPDOWN_ANIMATION_MS = 130;

/**
 * Keeps a node mounted for `durationMs` after `open` flips false, so the
 * close animation can play before unmount.
 */
export function usePresence(open: boolean, durationMs = DROPDOWN_ANIMATION_MS): boolean {
  const [present, setPresent] = React.useState(open);

  React.useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const t = window.setTimeout(() => setPresent(false), durationMs);
    return () => window.clearTimeout(t);
  }, [open, durationMs]);

  return present;
}

export interface OutsideDismissArgs {
  enabled: boolean;
  refs: Array<React.RefObject<HTMLElement | null>>;
  onDismiss: () => void;
}

/**
 * Calls `onDismiss` on any pointerdown outside every ref in `refs`
 * (capture phase, so portalled menus still count as "inside").
 */
export function useOutsideDismiss({enabled, refs, onDismiss}: OutsideDismissArgs): void {
  const refsRef = React.useRef(refs);
  React.useEffect(() => {
    refsRef.current = refs;
  });

  React.useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      for (const ref of refsRef.current) {
        const el = ref.current;
        if (el && el.contains(target)) return;
      }
      onDismiss();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [enabled, onDismiss]);
}

export interface DropdownStateArgs {
  disabled?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface DropdownState {
  open: boolean;
  openMenu: () => void;
  close: () => void;
  toggle: () => void;
  present: boolean;
  animateIn: boolean;
}

/**
 * Open/close state for a dropdown: `onOpenChange` notification on real
 * transitions only (not on mount), `defaultOpen` auto-open on first mount,
 * presence for the close animation and the double-rAF `animateIn` flag.
 *
 * `onOpen` runs synchronously before the open flip (position the menu, pick
 * the active option, schedule focus); `onClose` right after the close flip
 * (reset a search query). Both are read through refs, so inline arrows are fine.
 */
export function useDropdownState({
  disabled = false,
  defaultOpen = false,
  onOpenChange,
  onOpen,
  onClose,
}: DropdownStateArgs): DropdownState {
  const [open, setOpen] = React.useState(false);

  const onOpenRef = React.useRef(onOpen);
  const onCloseRef = React.useRef(onClose);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useLayoutEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onOpenChangeRef.current = onOpenChange;
  });

  // Mirrors `open` synchronously so close() can no-op when already closed
  // (no spurious onClose) without stale-closure churn. Updated inside the
  // callbacks, never during render.
  const openRef = React.useRef(open);

  const openMenu = React.useCallback(() => {
    if (disabled || openRef.current) return;
    onOpenRef.current?.();
    openRef.current = true;
    setOpen(true);
  }, [disabled]);

  const close = React.useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    onCloseRef.current?.();
  }, []);

  const toggle = React.useCallback(() => (openRef.current ? close() : openMenu()), [close, openMenu]);

  // notify on transitions only, never for the initial mount value
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onOpenChangeRef.current?.(open);
  }, [open]);

  const didAutoOpen = React.useRef(false);
  React.useEffect(() => {
    if (defaultOpen && !didAutoOpen.current && !disabled) {
      didAutoOpen.current = true;
      const raf = requestAnimationFrame(() => openMenu());
      return () => cancelAnimationFrame(raf);
    }
  }, [defaultOpen, disabled, openMenu]);

  const present = usePresence(open, DROPDOWN_ANIMATION_MS);

  const [animateIn, setAnimateIn] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!present) {
      setAnimateIn(false);
      return;
    }
    setAnimateIn(false);
    const raf = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(raf);
  }, [present]);

  return {open, openMenu, close, toggle, present, animateIn};
}
