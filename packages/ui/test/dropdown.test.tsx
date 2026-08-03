import * as React from 'react';
import {describe, expect, it, vi, afterEach} from 'vitest';
import {render, renderHook, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {usePresence, useOutsideDismiss, useDropdownState, DROPDOWN_ANIMATION_MS} from '../src/dropdown.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('usePresence', () => {
  it('stays present for the duration after close, then unmounts', () => {
    vi.useFakeTimers();
    const {result, rerender} = renderHook(({open}) => usePresence(open), {initialProps: {open: true}});
    expect(result.current).toBe(true);

    rerender({open: false});
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(DROPDOWN_ANIMATION_MS + 1);
    });
    expect(result.current).toBe(false);
  });

  it('cancels the pending unmount when reopened', () => {
    vi.useFakeTimers();
    const {result, rerender} = renderHook(({open}) => usePresence(open), {initialProps: {open: true}});
    rerender({open: false});
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({open: true});
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
  });
});

describe('useOutsideDismiss', () => {
  function Harness({enabled, onDismiss}: {enabled: boolean; onDismiss: () => void}) {
    const insideRef = React.useRef<HTMLDivElement | null>(null);
    const portalRef = React.useRef<HTMLDivElement | null>(null);
    useOutsideDismiss({enabled, refs: [insideRef, portalRef], onDismiss});
    return (
      <div>
        <div ref={insideRef} data-testid="inside" />
        <div ref={portalRef} data-testid="portal" />
        <div data-testid="outside" />
      </div>
    );
  }

  it('dismisses on outside pointerdown, not on any tracked ref', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const {getByTestId} = render(<Harness enabled onDismiss={onDismiss} />);

    await user.pointer({keys: '[MouseLeft>]', target: getByTestId('inside')});
    await user.pointer({keys: '[MouseLeft>]', target: getByTestId('portal')});
    expect(onDismiss).not.toHaveBeenCalled();

    await user.pointer({keys: '[MouseLeft>]', target: getByTestId('outside')});
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const {getByTestId} = render(<Harness enabled={false} onDismiss={onDismiss} />);
    await user.pointer({keys: '[MouseLeft>]', target: getByTestId('outside')});
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('useDropdownState', () => {
  it('does not notify onOpenChange for the initial mount value', () => {
    const onOpenChange = vi.fn();
    renderHook(() => useDropdownState({onOpenChange}));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('runs onOpen before the open flip and notifies transitions', () => {
    const calls: string[] = [];
    const {result} = renderHook(() =>
      useDropdownState({
        onOpen: () => calls.push('onOpen'),
        onOpenChange: open => calls.push(`change:${open}`),
      }),
    );
    act(() => result.current.openMenu());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(calls).toEqual(['onOpen', 'change:true', 'change:false']);
  });

  it('close() when already closed fires no onClose', () => {
    const onClose = vi.fn();
    const {result} = renderHook(() => useDropdownState({onClose}));
    act(() => result.current.close());
    expect(onClose).not.toHaveBeenCalled();

    act(() => result.current.openMenu());
    act(() => result.current.close());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('defaultOpen auto-opens exactly once', async () => {
    const onOpen = vi.fn();
    const {result} = renderHook(() => useDropdownState({defaultOpen: true, onOpen}));
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    });
    expect(result.current.open).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('disabled blocks openMenu and toggle', () => {
    const {result} = renderHook(() => useDropdownState({disabled: true}));
    act(() => result.current.openMenu());
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });
});
