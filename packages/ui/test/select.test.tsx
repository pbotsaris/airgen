import {describe, expect, it, vi, afterEach} from 'vitest';
import {render, screen, act, within, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Select} from '../src/components/Select.js';
import type {SelectOption} from '../src/types.js';

const FRUIT: SelectOption[] = [
  {value: 'apple', label: 'Apple'},
  {value: 'banana', label: 'Banana', disabled: true},
  {value: 'cherry', label: 'Cherry'},
  {value: 'new-york', label: 'New York'},
  {value: 'new-zealand', label: 'New Zealand'},
];

afterEach(() => {
  vi.useRealTimers();
});

function getListbox() {
  return screen.getByRole('listbox');
}

describe('Select (single)', () => {
  it('opens via click, selects via click, closes and fires onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={FRUIT} onChange={onChange} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // trigger's aria-controls points at the actual listbox element
    expect(trigger.getAttribute('aria-controls')).toBe(getListbox().id);

    await user.click(screen.getByRole('option', {name: 'Cherry'}));
    expect(onChange).toHaveBeenCalledWith('cherry');
    // menu unmounts after the close animation
    await vi.waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('opens with ArrowDown and moves the active option, skipping disabled', async () => {
    const user = userEvent.setup();
    render(<Select options={FRUIT} defaultValue="apple" />);
    const trigger = screen.getByRole('button');

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const listbox = getListbox();
    const apple = within(listbox).getByRole('option', {name: /Apple/});
    expect(apple).toHaveFocus();

    // ArrowDown skips disabled Banana straight to Cherry
    await user.keyboard('{ArrowDown}');
    expect(within(listbox).getByRole('option', {name: /Cherry/})).toHaveFocus();

    // wraps forward past the end
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(apple).toHaveFocus();
  });

  it('Home and End jump to first/last enabled option', async () => {
    const user = userEvent.setup();
    render(<Select options={FRUIT} />);
    await user.click(screen.getByRole('button'));

    await user.keyboard('{End}');
    expect(screen.getByRole('option', {name: /New Zealand/})).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('option', {name: /Apple/})).toHaveFocus();
  });

  it('Enter selects the active option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={FRUIT} onChange={onChange} />);
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}'); // open
    await user.keyboard('{ArrowDown}'); // -> cherry (banana disabled)
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  // The typeahead tests need fake timers (700ms buffer expiry), and
  // user-event deadlocks under Vitest fake timers — so these drive keys with
  // synchronous fireEvent on the menu instead.
  it('Space with an empty typeahead buffer selects; mid-buffer it extends the query', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    const onChange = vi.fn();
    render(<Select options={FRUIT} onChange={onChange} />);
    act(() => {
      fireEvent.keyDown(screen.getByRole('button'), {key: 'Enter'});
    });
    const listbox = getListbox();

    // typeahead "new z" -> New Zealand (space extends the buffer, no select)
    for (const key of [...'new z']) fireEvent.keyDown(listbox, {key});
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('option', {name: /New Zealand/})).toHaveFocus();

    // buffer expires; bare Space now selects the active option
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.keyDown(listbox, {key: ' '});
    expect(onChange).toHaveBeenCalledWith('new-zealand');
  });

  it('typeahead matches prefixes and repeated keys collapse to one letter', () => {
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout']});
    render(<Select options={FRUIT} />);
    act(() => {
      fireEvent.keyDown(screen.getByRole('button'), {key: 'Enter'});
    });
    const listbox = getListbox();

    fireEvent.keyDown(listbox, {key: 'n'});
    expect(screen.getByRole('option', {name: /New York/})).toHaveFocus();
    // repeated char keeps matching the single-char prefix
    fireEvent.keyDown(listbox, {key: 'n'});
    expect(screen.getByRole('option', {name: /New York/})).toHaveFocus();
  });

  it('Escape closes without change and refocuses the trigger', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={FRUIT} defaultValue="apple" onChange={onChange} />);
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('outside pointerdown closes the menu', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Select options={FRUIT} />
        <button type="button">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', {name: /Select/}));
    expect(screen.queryAllByRole('listbox')).toHaveLength(1);
    await user.pointer({keys: '[MouseLeft>]', target: screen.getByRole('button', {name: 'outside'})});
    await vi.waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('works controlled: renders the value and reports changes without mutating itself', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const {rerender} = render(<Select options={FRUIT} value="apple" onChange={onChange} />);
    expect(screen.getByRole('button')).toHaveTextContent('Apple');

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('option', {name: 'Cherry'}));
    expect(onChange).toHaveBeenCalledWith('cherry');
    // still apple until the parent re-renders
    expect(screen.getByRole('button')).toHaveTextContent('Apple');
    rerender(<Select options={FRUIT} value="cherry" onChange={onChange} />);
    expect(screen.getByRole('button')).toHaveTextContent('Cherry');
  });

  it('marks the selected option and disabled options with ARIA', async () => {
    const user = userEvent.setup();
    render(<Select options={FRUIT} defaultValue="cherry" />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('option', {name: /Cherry/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', {name: /Apple/})).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', {name: /Banana/})).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows emptyMessage for an empty options list even when not searchable', async () => {
    const user = userEvent.setup();
    render(<Select options={[]} emptyMessage="Nothing here" />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renderTrigger receives the forwarded id', () => {
    render(
      <Select
        options={FRUIT}
        id="my-select"
        renderTrigger={({ref, id: triggerId, toggle}) => (
          <button ref={ref} id={triggerId} onClick={toggle} data-testid="custom-trigger" />
        )}
      />,
    );
    expect(screen.getByTestId('custom-trigger')).toHaveAttribute('id', 'my-select');
  });

  it('groups render headers without stealing keyboard focus order', async () => {
    const user = userEvent.setup();
    const grouped: SelectOption[] = [
      {value: 'a', label: 'Alpha', group: 'G1'},
      {value: 'b', label: 'Beta', group: 'G2'},
    ];
    render(<Select options={grouped} groups={[{key: 'G1', label: 'Group One'}]} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Group One')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', {name: /Beta/})).toHaveFocus();
  });

  describe('searchable', () => {
    it('focuses the input, wires combobox ARIA, filters, and selects with Enter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={FRUIT} searchable onChange={onChange} />);
      await user.click(screen.getByRole('button'));

      const input = await vi.waitFor(() => {
        const el = screen.getByRole('combobox');
        expect(el).toHaveFocus();
        return el;
      });
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input.getAttribute('aria-controls')).toBe(getListbox().id);

      await user.keyboard('cher');
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith('cherry');
    });

    it('arrow navigation in the search input skips disabled options', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Select options={FRUIT} searchable onChange={onChange} />);
      await user.click(screen.getByRole('button'));
      await vi.waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());

      // active starts at Apple (0); ArrowDown must skip disabled Banana (1)
      await user.keyboard('{ArrowDown}{Enter}');
      expect(onChange).toHaveBeenCalledWith('cherry');
    });

    it('shows emptyMessage when the query matches nothing', async () => {
      const user = userEvent.setup();
      render(<Select options={FRUIT} searchable emptyMessage="No match" />);
      await user.click(screen.getByRole('button'));
      await vi.waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
      await user.keyboard('zzzz');
      expect(screen.getByText('No match')).toBeInTheDocument();
    });

    it('respects maxItems while the query is empty', async () => {
      const user = userEvent.setup();
      render(<Select options={FRUIT} searchable maxItems={2} />);
      await user.click(screen.getByRole('button'));
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });
  });
});
