import * as React from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SheetProvider, useSheet, type SheetAPI} from '../src/providers/SheetProvider.js';

function setup(providerProps: Omit<React.ComponentProps<typeof SheetProvider>, 'children'> = {}) {
  const api: {current: SheetAPI | null} = {current: null};
  function Grab() {
    api.current = useSheet();
    return null;
  }
  render(
    <SheetProvider {...providerProps}>
      <Grab />
    </SheetProvider>,
  );
  return {api: api as {current: SheetAPI}};
}

describe('SheetProvider', () => {
  it('opens a sheet with title and node content — and no stray "Sheet" text', () => {
    const {api} = setup();
    act(() => {
      api.current.openSheet({title: 'Details', content: <p>Body here</p>});
    });
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Body here')).toBeInTheDocument();
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe(screen.getByText('Details').id);
    // regression: the source rendered a bare "Sheet" text node into the portal
    expect(screen.queryByText('Sheet')).toBeNull();
  });

  it('function content receives {close, data} and close works', async () => {
    const {api} = setup();
    act(() => {
      api.current.openSheet({
        data: {n: 41},
        content: ({close, data}) => (
          <button onClick={close}>value {(data as {n: number}).n + 1}</button>
        ),
      });
    });
    const btn = screen.getByRole('button', {name: 'value 42'});
    await userEvent.setup().click(btn);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('content unmounts after the exit animation instead of staying mounted forever', async () => {
    const cleanup = vi.fn();
    function Probe() {
      // the effect cleanup tells us the content really unmounted
      React.useEffect(() => cleanup, []);
      return <span>probe</span>;
    }
    const {api} = setup();
    act(() => {
      api.current.openSheet({content: <Probe />});
    });
    expect(screen.getByText('probe')).toBeInTheDocument();

    act(() => {
      api.current.closeSheet();
    });
    // still mounted during the 200ms exit
    expect(cleanup).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalled());
    expect(screen.queryByText('probe')).toBeNull();
  });

  it('omits the header entirely when no title is given', () => {
    const {api} = setup();
    act(() => {
      api.current.openSheet({content: <p>Just content</p>});
    });
    expect(screen.queryByRole('button', {name: 'Close'})).toBeNull();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
  });

  it('renderHeader replaces the default header', () => {
    const {api} = setup();
    act(() => {
      api.current.openSheet({
        title: 'ignored-title-display',
        renderHeader: ({close, title}) => <button onClick={close}>custom {title}</button>,
        content: <p>c</p>,
      });
    });
    expect(screen.getByRole('button', {name: 'custom ignored-title-display'})).toBeInTheDocument();
  });

  it('applies per-request side and className plus provider defaults', () => {
    const {api} = setup({className: 'w-96'});
    act(() => {
      api.current.openSheet({side: 'left', className: 'p-10', content: <p>c</p>});
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('left-0');
    expect(dialog.className).toContain('w-96');
    expect(dialog.className).toContain('p-10');
  });

  it('useSheet outside the provider throws', () => {
    function Bad() {
      useSheet();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/within <SheetProvider>/);
  });
});
