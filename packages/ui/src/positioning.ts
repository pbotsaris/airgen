import * as React from 'react';
import {clamp} from './utils.js';

/**
 * The single anchored-positioning engine for every floating surface (Select
 * menu, Popover, Tooltip). Replaces the three near-identical engines the
 * source components carried.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';

export interface AnchoredPositionOptions {
  /** Listeners and measuring are active only while open. */
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /**
   * Ref to the floating element. When omitted the hook runs in anchor-only
   * mode: it measures just the anchor, so `update()` can be called before the
   * floating element mounts (Select positions its menu in `onOpen`, before
   * the open flip, so the first painted frame is already in place). Anchor-only
   * mode is bottom-side only and never clamps or flips.
   */
  contentRef?: React.RefObject<HTMLElement | null>;
  side?: Side;
  align?: Align;
  /** Gap between anchor and content in px. */
  offset?: number;
  /** Viewport clamp margin (content mode only). */
  collisionPadding?: number;
  /** Disable the viewport clamp entirely (content mode only). */
  avoidCollisions?: boolean;
  /** Flip to the opposite side when the content overflows it (content mode only). */
  flip?: boolean;
  /** Emit `style.width` equal to the anchor's width. */
  matchAnchorWidth?: boolean;
}

export interface AnchoredPositionResult {
  /** Spread onto the floating element: position fixed + coordinates. */
  style: React.CSSProperties;
  /**
   * False until the first successful measure. Content-mode consumers should
   * render invisible (`opacity-0`) until ready to avoid a mispositioned first
   * frame; always true in anchor-only mode once the anchor is measured.
   */
  ready: boolean;
  /** The side actually used after flipping (drives transform-origin/animations). */
  placedSide: Side;
  /** Measured anchor width in px (for min-width math). */
  anchorWidth: number;
  /** Imperative re-measure; call before opening for a correct first frame. */
  update: () => void;
  /**
   * Attach as (part of) the floating element's ref. Measures synchronously
   * the moment the node mounts — needed because portalled content can attach
   * after this hook's layout effect has already run (Portal's mount gate).
   */
  contentRefCallback: (node: HTMLElement | null) => void;
}

function transformOrigin(side: Side, align: Align): string {
  const a = align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
  if (side === 'top') return `bottom ${a}`;
  if (side === 'bottom') return `top ${a}`;
  if (side === 'left') return `${a} right`;
  return `${a} left`;
}

interface PositionState {
  style: React.CSSProperties;
  ready: boolean;
  placedSide: Side;
  anchorWidth: number;
}

export function useAnchoredPosition({
  open,
  anchorRef,
  contentRef,
  side = 'bottom',
  align = 'start',
  offset = 6,
  collisionPadding = 8,
  avoidCollisions = true,
  flip = false,
  matchAnchorWidth = false,
}: AnchoredPositionOptions): AnchoredPositionResult {
  const [state, setState] = React.useState<PositionState>({
    style: {position: 'fixed', top: 0, left: 0},
    ready: false,
    placedSide: side,
    anchorWidth: 0,
  });

  const update = React.useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();

    if (!contentRef) {
      // Anchor-only mode: below the anchor, aligned to its left or right edge.
      // `right` is measured against documentElement.clientWidth (the layout
      // viewport, which excludes a classic scrollbar) because fixed-position
      // `right` resolves against it — window.innerWidth would offset the menu
      // by the scrollbar width.
      const style: React.CSSProperties = {
        position: 'fixed',
        top: Math.round(rect.bottom + offset),
      };
      if (align === 'end') {
        style.right = Math.round(document.documentElement.clientWidth - rect.right);
      } else {
        style.left = Math.round(rect.left);
      }
      if (matchAnchorWidth) style.width = Math.round(rect.width);
      setState({style, ready: true, placedSide: 'bottom', anchorWidth: Math.round(rect.width)});
      return;
    }

    const content = contentRef.current;
    if (!content) return;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const alignX = () => (align === 'start' ? rect.left : align === 'end' ? rect.right - cw : rect.left + (rect.width - cw) / 2);
    const alignY = () => (align === 'start' ? rect.top : align === 'end' ? rect.bottom - ch : rect.top + (rect.height - ch) / 2);

    const compute = (s: Side): {top: number; left: number} => {
      if (s === 'bottom') return {top: rect.bottom + offset, left: alignX()};
      if (s === 'top') return {top: rect.top - ch - offset, left: alignX()};
      if (s === 'right') return {top: alignY(), left: rect.right + offset};
      return {top: alignY(), left: rect.left - cw - offset};
    };

    const overflows = (s: Side, p: {top: number; left: number}): boolean => {
      if (s === 'bottom') return p.top + ch > vh - collisionPadding;
      if (s === 'top') return p.top < collisionPadding;
      if (s === 'right') return p.left + cw > vw - collisionPadding;
      return p.left < collisionPadding;
    };

    const OPPOSITE: Record<Side, Side> = {top: 'bottom', bottom: 'top', left: 'right', right: 'left'};

    let placedSide = side;
    let pos = compute(side);
    if (flip && overflows(side, pos)) {
      const flipped = compute(OPPOSITE[side]);
      if (!overflows(OPPOSITE[side], flipped)) {
        placedSide = OPPOSITE[side];
        pos = flipped;
      }
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      top: avoidCollisions ? clamp(pos.top, collisionPadding, vh - ch - collisionPadding) : pos.top,
      left: avoidCollisions ? clamp(pos.left, collisionPadding, vw - cw - collisionPadding) : pos.left,
      transformOrigin: transformOrigin(placedSide, align),
    };
    if (matchAnchorWidth) style.width = Math.round(rect.width);
    setState({style, ready: true, placedSide, anchorWidth: Math.round(rect.width)});
  }, [anchorRef, contentRef, side, align, offset, collisionPadding, avoidCollisions, flip, matchAnchorWidth]);

  // `ready` is not reset on close: the node keeps its measured position for
  // the exit animation, and a reopen re-measures before paint anyway via
  // `contentRefCallback` (mount) and the open effect below.
  React.useLayoutEffect(() => {
    if (!open) return;

    // Reposition when the content itself changes size (e.g. async children).
    // Attached lazily: portalled content can mount a beat after this effect.
    let observer: ResizeObserver | undefined;
    const observeContent = () => {
      if (observer || !contentRef?.current || typeof ResizeObserver === 'undefined') return;
      observer = new ResizeObserver(() => update());
      observer.observe(contentRef.current);
    };

    update();
    observeContent();
    // Retry on the next frame in case refs weren't attached yet (content
    // rendered before trigger in the tree, or behind a portal mount gate).
    const raf = requestAnimationFrame(() => {
      update();
      observeContent();
    });

    const onScrollOrResize = () => update();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      observer?.disconnect();
    };
  }, [open, update, contentRef]);

  const contentRefCallback = React.useCallback(
    (node: HTMLElement | null) => {
      // cast: RefObject.current is typed readonly under @types/react@17
      if (contentRef) (contentRef as {current: HTMLElement | null}).current = node;
      if (node) update();
    },
    [contentRef, update],
  );

  return {style: state.style, ready: state.ready, placedSide: state.placedSide, anchorWidth: state.anchorWidth, update, contentRefCallback};
}
