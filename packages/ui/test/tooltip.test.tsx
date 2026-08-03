import {describe, expect, it, vi, afterEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Tooltip, TooltipTrigger, TooltipContent} from '../src/components/Tooltip.js';

afterEach(() => {
  vi.useRealTimers();
});

function basicTooltip(rootProps: React.ComponentProps<typeof Tooltip> = {}, asChild = false) {
  return (
    <Tooltip {...rootProps}>
      <TooltipTrigger asChild={asChild}>
        <button>Hover me</button>
      </TooltipTrigger>
      <TooltipContent>Helpful text</TooltipContent>
    </Tooltip>
  );
}

describe('Tooltip', () => {
  // user-event deadlocks under Vitest fake timers, so hover timing tests use
  // fireEvent + advanceTimersByTime.
  it('opens after the delay on hover and closes immediately on leave', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    render(basicTooltip());
    const trigger = screen.getByRole('button', {name: 'Hover me'}).parentElement!;

    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text');

    fireEvent.pointerLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('an early pointer leave cancels the pending open', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    render(basicTooltip());
    const trigger = screen.getByRole('button', {name: 'Hover me'}).parentElement!;

    fireEvent.pointerEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on focus and closes on blur', async () => {
    const user = userEvent.setup();
    render(basicTooltip({delay: 0}));
    await user.tab();
    await vi.waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await user.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('Escape closes while open', async () => {
    const user = userEvent.setup();
    render(basicTooltip({delay: 0}));
    await user.tab();
    await vi.waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('asChild puts aria-describedby on the real trigger only while open', async () => {
    const user = userEvent.setup();
    render(basicTooltip({delay: 0}, true));
    const button = screen.getByRole('button', {name: 'Hover me'});
    expect(button).not.toHaveAttribute('aria-describedby');

    await user.tab();
    await vi.waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    });

    await user.tab();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('supports controlled open', () => {
    const {rerender} = render(basicTooltip({open: true}));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    rerender(basicTooltip({open: false}));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('content ignores pointer events by default and accepts them when hoverable', () => {
    const {rerender} = render(basicTooltip({open: true}));
    expect(screen.getByRole('tooltip')).toHaveStyle({pointerEvents: 'none'});
    rerender(basicTooltip({open: true, disableHoverableContent: false}));
    expect(screen.getByRole('tooltip')).toHaveStyle({pointerEvents: 'auto'});
  });
});
