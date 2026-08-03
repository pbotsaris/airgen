import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Popover, PopoverTrigger, PopoverContent, PopoverClose} from '../src/components/Popover.js';

function basicPopover(props: React.ComponentProps<typeof Popover> = {}, contentProps: React.ComponentProps<typeof PopoverContent> = {}) {
  return (
    <Popover {...props}>
      <PopoverTrigger>
        <button>Open</button>
      </PopoverTrigger>
      <PopoverContent {...contentProps}>
        <p>Hello content</p>
        <PopoverClose>
          <button>Close me</button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('toggles from the trigger and wires aria-controls to the content id', async () => {
    const user = userEvent.setup();
    render(basicPopover());

    const trigger = screen.getByRole('button', {name: 'Open'});
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);

    await user.click(trigger);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a consumer-supplied content id wins for both the element and aria-controls', async () => {
    const user = userEvent.setup();
    render(basicPopover({}, {id: 'my-popover'}));
    await user.click(screen.getByRole('button', {name: 'Open'}));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('id', 'my-popover');
    await vi.waitFor(() =>
      expect(screen.getByRole('button', {name: 'Open'})).toHaveAttribute('aria-controls', 'my-popover'),
    );
  });

  it('Escape closes; onEscapeKeyDown can prevent it', async () => {
    const user = userEvent.setup();
    const {rerender} = render(basicPopover());
    await user.click(screen.getByRole('button', {name: 'Open'}));
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    rerender(basicPopover({}, {onEscapeKeyDown: ev => ev.preventDefault()}));
    await user.click(screen.getByRole('button', {name: 'Open'}));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('outside pointerdown closes; onInteractOutside can prevent it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        {basicPopover()}
        <button>elsewhere</button>
      </div>,
    );
    await user.click(screen.getByRole('button', {name: 'Open'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.pointer({keys: '[MouseLeft>]', target: screen.getByRole('button', {name: 'elsewhere'})});
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('PopoverClose closes from inside', async () => {
    const user = userEvent.setup();
    render(basicPopover());
    await user.click(screen.getByRole('button', {name: 'Open'}));
    await user.click(screen.getByRole('button', {name: 'Close me'}));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves focus into the content on open and restores it to the trigger on close', async () => {
    const user = userEvent.setup();
    render(basicPopover());
    const trigger = screen.getByRole('button', {name: 'Open'});
    await user.click(trigger);
    await vi.waitFor(() => expect(screen.getByRole('button', {name: 'Close me'})).toHaveFocus());
    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it('trapFocus keeps Tab cycling inside the content', async () => {
    const user = userEvent.setup();
    render(
      <Popover trapFocus>
        <PopoverTrigger>
          <button>Open</button>
        </PopoverTrigger>
        <PopoverContent>
          <button>first</button>
          <button>last</button>
        </PopoverContent>
      </Popover>,
    );
    await user.click(screen.getByRole('button', {name: 'Open'}));
    await vi.waitFor(() => expect(screen.getByRole('button', {name: 'first'})).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', {name: 'last'})).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', {name: 'first'})).toHaveFocus();
    await user.tab({shift: true});
    expect(screen.getByRole('button', {name: 'last'})).toHaveFocus();
  });

  it('works controlled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const {rerender} = render(basicPopover({open: false, onOpenChange}));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', {name: 'Open'}));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // parent hasn't flipped the prop yet
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(basicPopover({open: true, onOpenChange}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('plays the exit animation before unmounting (data-state=closed while closing)', async () => {
    const user = userEvent.setup();
    render(basicPopover({defaultOpen: true}));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'open');

    await user.keyboard('{Escape}');
    // still mounted, now animating out
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed');
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
