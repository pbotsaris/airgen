import {describe, expect, it, vi, afterEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import {ToastProvider, useToast, type ToastAPI} from '../src/providers/ToastProvider.js';

afterEach(() => {
  vi.useRealTimers();
});

function setup(providerProps: Omit<React.ComponentProps<typeof ToastProvider>, 'children'> = {}) {
  const api: {current: ToastAPI | null} = {current: null};
  function Grab() {
    api.current = useToast();
    return null;
  }
  const view = render(
    <ToastProvider {...providerProps}>
      <Grab />
    </ToastProvider>,
  );
  return {api: api as {current: ToastAPI}, view};
}

describe('ToastProvider', () => {
  it('the live region exists before any toast is shown', () => {
    setup();
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region!.textContent).toBe('');
  });

  it('shows toasts and auto-dismisses at each type duration', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const {api} = setup();

    act(() => {
      api.current.info('info msg');
      api.current.warning('warn msg');
      api.current.error('boom');
    });
    expect(screen.getByText('info msg')).toBeInTheDocument();
    expect(screen.getByText('warn msg')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    // errors are announced assertively
    expect(screen.getByRole('alert')).toHaveTextContent('boom');

    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText('info msg')).toBeNull();
    expect(screen.getByText('warn msg')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('warn msg')).toBeNull();
    expect(screen.getByText('boom')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('delayed toasts with different keys both fire; same key debounces', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const {api} = setup();

    act(() => {
      api.current.toast('first', {delay: 100});
      api.current.toast('second', {delay: 100});
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    // different messages -> different default keys -> both survive
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();

    act(() => {
      api.current.toast('again', {delay: 100, key: 'k'});
      vi.advanceTimersByTime(50);
      api.current.toast('again', {delay: 100, key: 'k'});
      vi.advanceTimersByTime(60);
    });
    // first call was debounced away; only one instance appears after reset
    expect(screen.queryByText('again')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getAllByText('again')).toHaveLength(1);
  });

  it('dismiss(id) removes a toast; clear() removes all', () => {
    const {api} = setup();
    let id = '';
    act(() => {
      id = api.current.toast('closable', {duration: 0});
      api.current.toast('other', {duration: 0});
    });
    act(() => {
      api.current.dismiss(id);
    });
    expect(screen.queryByText('closable')).toBeNull();
    expect(screen.getByText('other')).toBeInTheDocument();

    act(() => {
      api.current.clear();
    });
    expect(screen.queryByText('other')).toBeNull();
  });

  it('the dismiss button plays the exit before removal', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const {api} = setup();
    act(() => {
      api.current.toast('manual', {duration: 0});
    });
    fireEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    // still mounted during the 300ms exit transition
    expect(screen.getByText('manual')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(301);
    });
    expect(screen.queryByText('manual')).toBeNull();
  });

  it('caps the stack at maxToasts, dropping the oldest', () => {
    const {api} = setup({maxToasts: 2});
    act(() => {
      api.current.toast('one', {duration: 0});
      api.current.toast('two', {duration: 0});
      api.current.toast('three', {duration: 0});
    });
    expect(screen.queryByText('one')).toBeNull();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
  });

  it('renders into a custom container and position', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const {api} = setup({container, position: 'bottom-left'});
    act(() => {
      api.current.info('placed');
    });
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(container.querySelector('.bottom-4.left-4')).not.toBeNull();
  });

  it('unmounting with pending delayed toasts does not warn or throw', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const {api, view} = setup();
    act(() => {
      api.current.toast('late', {delay: 1000});
    });
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // timer was cleared on unmount; nothing to assert beyond "no crash"
    expect(document.querySelector('[aria-live]')).toBeNull();
  });
});
