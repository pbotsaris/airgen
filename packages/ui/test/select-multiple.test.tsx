import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Select} from '../src/components/Select.js';
import type {SelectOption} from '../src/types.js';

const TAGS: SelectOption[] = [
  {value: 'design', label: 'Design'},
  {value: 'dev', label: 'Dev', color: 'blueBright'},
  {value: 'ops', label: 'Ops'},
];

function getTrigger() {
  return screen.getByRole('combobox');
}

describe('Select (multiple)', () => {
  it('renders a combobox div trigger with listbox ARIA and placeholder when empty', () => {
    render(<Select multiple options={TAGS} placeholder="Pick tags" />);
    const trigger = getTrigger();
    expect(trigger.tagName).toBe('DIV');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Pick tags');
  });

  it('toggling an option keeps the menu open and fires array onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select multiple options={TAGS} onChange={onChange} />);

    await user.click(getTrigger());
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');

    await user.click(screen.getByRole('option', {name: 'Design'}));
    expect(onChange).toHaveBeenLastCalledWith(['design']);
    // menu stays open
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('option', {name: /Dev/}));
    expect(onChange).toHaveBeenLastCalledWith(['design', 'dev']);

    // toggling a selected option removes it
    await user.click(screen.getByRole('option', {name: /Design/}));
    expect(onChange).toHaveBeenLastCalledWith(['dev']);
  });

  it('renders pills in selection order with working remove buttons', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select multiple options={TAGS} defaultValue={['ops', 'design']} onChange={onChange} />);

    const trigger = getTrigger();
    // selection order, not options order
    expect(trigger.textContent!.indexOf('Ops')).toBeLessThan(trigger.textContent!.indexOf('Design'));

    await user.click(screen.getByRole('button', {name: 'Remove Ops'}));
    expect(onChange).toHaveBeenLastCalledWith(['design']);
    // removing a pill must not toggle the menu open
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('marks selected options with aria-selected and a checkmark', async () => {
    const user = userEvent.setup();
    render(<Select multiple options={TAGS} defaultValue={['dev']} />);
    await user.click(getTrigger());
    expect(screen.getByRole('option', {name: /Dev/})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', {name: /Design/})).toHaveAttribute('aria-selected', 'false');
  });

  it('Backspace on the closed trigger removes the last pill', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select multiple options={TAGS} defaultValue={['design', 'dev']} onChange={onChange} />);
    getTrigger().focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['design']);
  });

  it('Enter toggles without closing; Escape closes and refocuses the trigger', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select multiple options={TAGS} onChange={onChange} />);
    const trigger = getTrigger();
    trigger.focus();
    await user.keyboard('{Enter}'); // open
    await user.keyboard('{Enter}'); // toggle Design (first enabled)
    expect(onChange).toHaveBeenLastCalledWith(['design']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('searchable: Backspace with empty query removes the last pill, with query it edits the query', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select multiple searchable options={TAGS} defaultValue={['ops']} onChange={onChange} />);

    await user.click(getTrigger());
    const input = await vi.waitFor(() => {
      const el = screen.getAllByRole('combobox').find(e => e.tagName === 'INPUT')!;
      expect(el).toHaveFocus();
      return el;
    });

    await user.keyboard('de');
    await user.keyboard('{Backspace}');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('d');

    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('');
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('searchable: the query survives a toggle so several matches can be picked', async () => {
    const user = userEvent.setup();
    render(<Select multiple searchable options={TAGS} />);
    await user.click(getTrigger());
    await vi.waitFor(() => {
      expect(screen.getAllByRole('combobox').some(e => e.tagName === 'INPUT' && e === document.activeElement)).toBe(true);
    });
    await user.keyboard('de');
    const input = screen.getAllByRole('combobox').find(e => e.tagName === 'INPUT')!;
    await user.keyboard('{Enter}'); // toggle first match
    expect(input).toHaveValue('de');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('works controlled with string[] value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const {rerender} = render(<Select multiple options={TAGS} value={['design']} onChange={onChange} />);
    expect(getTrigger()).toHaveTextContent('Design');

    await user.click(getTrigger());
    await user.click(screen.getByRole('option', {name: /Dev/}));
    expect(onChange).toHaveBeenCalledWith(['design', 'dev']);
    // parent controls: still one pill until rerender
    expect(screen.queryByRole('button', {name: 'Remove Dev'})).toBeNull();
    rerender(<Select multiple options={TAGS} value={['design', 'dev']} onChange={onChange} />);
    expect(screen.getByRole('button', {name: 'Remove Dev'})).toBeInTheDocument();
  });
});
