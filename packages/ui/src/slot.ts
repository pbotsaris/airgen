import * as React from 'react';

/**
 * Helpers for `asChild` / cloneElement trigger patterns (Dialog.Trigger,
 * Popover.Trigger, TooltipTrigger). One copy instead of one per component.
 */

/**
 * Reads the ref off a React element across React versions: on React 19 the
 * ref lives in `props.ref`; on <=18 it is the legacy `element.ref` (reading
 * it on 19 warns, so props is checked first).
 */
export function getElementRef(element: React.ReactElement): React.Ref<unknown> | undefined {
  const fromProps = (element.props as {ref?: React.Ref<unknown>}).ref;
  if (fromProps !== undefined && fromProps !== null) return fromProps;
  return (element as unknown as {ref?: React.Ref<unknown>}).ref ?? undefined;
}

/**
 * Chains an outer click handler after the element's own: the child's handler
 * runs first, then `outer` unless the event's default was prevented.
 */
export function composeClickHandler<E extends {defaultPrevented: boolean}>(
  child: ((e: E) => void) | undefined,
  outer: (e: E) => void,
): (e: E) => void {
  return e => {
    child?.(e);
    if (e.defaultPrevented) return;
    outer(e);
  };
}
