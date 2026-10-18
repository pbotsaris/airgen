import * as React from 'react';
import {createPortal} from 'react-dom';
import {ThemeScope, useThemeScheme} from '../providers/ThemeProvider.js';

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
 * `document`). Under a ThemeProvider the content is wrapped in its scheme,
 * since the portal target sits outside the provider's element.
 */
export function Portal({children, container}: PortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const scheme = useThemeScheme();

  React.useLayoutEffect(() => setMounted(true), []);
  const target = container ?? (mounted ? document.body : null);
  if (!target) return null;

  return createPortal(scheme === null ? children : <ThemeScope scheme={scheme}>{children}</ThemeScope>, target);
}
