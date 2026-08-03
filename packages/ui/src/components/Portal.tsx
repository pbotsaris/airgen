import * as React from 'react';
import {createPortal} from 'react-dom';

export interface PortalProps {
  children?: React.ReactNode;
  /** Where to mount; defaults to document.body. */
  container?: Element | DocumentFragment | null;
}

/**
 * Renders children into `container` (default document.body) after first mount.
 *
 * The mount gate keeps the portal target resolution out of the initial render,
 * so components can render `<Portal>` unconditionally (and SSR never touches
 * `document`).
 */
export function Portal({children, container}: PortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => setMounted(true), []);
  const target = container ?? (mounted ? document.body : null);

  return target ? createPortal(children, target) : null;
}
