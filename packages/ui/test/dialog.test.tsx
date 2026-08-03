import * as React from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Dialog, Sheet} from '../src/components/DialogSheet.js';

function basicDialog({withTitle = true, withDescription = true, asChild = false, content = {} as Record<string, unknown>} = {}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild={asChild}>{asChild ? <button>Open it</button> : 'Open it'}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay data-testid="overlay" />
        <Dialog.Content {...content}>
          {withTitle && <Dialog.Title>My title</Dialog.Title>}
          {withDescription && <Dialog.Description>My description</Dialog.Description>}
          <input placeholder="first field" />
          <Dialog.Close>Dismiss</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

describe('Dialog', () => {
  it('opens via trigger (plain and asChild) and closes via Close', async () => {
    const user = userEvent.setup();
    const {unmount} = render(basicDialog());
    await user.click(screen.getByRole('button', {name: 'Open it'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Dismiss'}));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    unmount();

    render(basicDialog({asChild: true}));
    const trigger = screen.getByRole('button', {name: 'Open it'});
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('clicking the overlay closes; clicking inside the content does not', async () => {
    const user = userEvent.setup();
    render(basicDialog());
    await user.click(screen.getByRole('button', {name: 'Open it'}));

    await user.click(screen.getByPlaceholderText('first field'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('overlay'));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Escape closes and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(basicDialog());
    const trigger = screen.getByRole('button', {name: 'Open it'});
    await user.click(trigger);
    await vi.waitFor(() => expect(screen.getByPlaceholderText('first field')).toHaveFocus());

    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it('nested dialogs: Escape closes only the focused inner dialog', async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root>
        <Dialog.Trigger>Open outer</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content aria-label="outer">
            <Dialog.Title>Outer</Dialog.Title>
            <Dialog.Root>
              <Dialog.Trigger>Open inner</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Content aria-label="inner">
                  <Dialog.Title>Inner</Dialog.Title>
                  <button>inner focusable</button>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole('button', {name: 'Open outer'}));
    await user.click(screen.getByRole('button', {name: 'Open inner'}));
    await vi.waitFor(() => expect(screen.getByRole('button', {name: 'inner focusable'})).toHaveFocus());
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByText('Inner')).toBeNull());
    // the outer dialog survived
    expect(screen.getByText('Outer')).toBeInTheDocument();
  });

  it('traps Tab inside the content and honors initialFocusRef', async () => {
    const user = userEvent.setup();
    function Harness() {
      const focusRef = React.useRef<HTMLButtonElement | null>(null);
      return (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Content initialFocusRef={focusRef}>
              <Dialog.Title>T</Dialog.Title>
              <input placeholder="a" />
              <button ref={focusRef}>b</button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }
    render(<Harness />);
    await vi.waitFor(() => expect(screen.getByRole('button', {name: 'b'})).toHaveFocus());

    // Tab from the last focusable wraps to the first
    await user.tab();
    expect(screen.getByPlaceholderText('a')).toHaveFocus();
    await user.tab({shift: true});
    expect(screen.getByRole('button', {name: 'b'})).toHaveFocus();
  });

  it('locks body scroll while open and restores on close', async () => {
    const user = userEvent.setup();
    render(basicDialog());
    expect(document.body.style.overflow).not.toBe('hidden');
    await user.click(screen.getByRole('button', {name: 'Open it'}));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });

  it('emits aria-labelledby/describedby only when Title/Description exist', async () => {
    const user = userEvent.setup();
    const {unmount} = render(basicDialog());
    await user.click(screen.getByRole('button', {name: 'Open it'}));
    let dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('My title').id);
    expect(dialog.getAttribute('aria-describedby')).toBe(screen.getByText('My description').id);
    unmount();

    render(basicDialog({withTitle: false, withDescription: false}));
    await user.click(screen.getByRole('button', {name: 'Open it'}));
    dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  it('keeps the content mounted with data-state=closed during the exit animation', async () => {
    const user = userEvent.setup();
    render(basicDialog());
    await user.click(screen.getByRole('button', {name: 'Open it'}));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'open');

    await user.keyboard('{Escape}');
    expect(dialog).toHaveAttribute('data-state', 'closed');
    expect(document.body.contains(dialog)).toBe(true);
    await vi.waitFor(() => expect(document.body.contains(dialog)).toBe(false));
  });
});

describe('Sheet', () => {
  it('renders side classes and a real background color', async () => {
    const user = userEvent.setup();
    render(
      <Sheet.Root>
        <Sheet.Trigger>Open sheet</Sheet.Trigger>
        <Sheet.Portal>
          <Sheet.Content side="left" data-testid="sheet">
            <Sheet.Title>Panel</Sheet.Title>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>,
    );
    await user.click(screen.getByRole('button', {name: 'Open sheet'}));
    const sheet = screen.getByTestId('sheet');
    expect(sheet.className).toContain('left-0');
    expect(sheet.className).toContain('slide-in-from-left');
    expect(sheet.className).toContain('bg-white');
    expect(sheet.className).not.toContain('bg-background');
  });
});
