import * as React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {createPortal} from 'react-dom';
import {InlineEdit} from '../src/index';

describe('InlineEdit', () => {
  test('edits on click, selects text, commits once on Enter and preserves the input node', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    function Example() {
      const [value, setValue] = React.useState('Original');
      return (
        <InlineEdit
          label="Name"
          value={value}
          onCommit={next => {
            save(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Example />);
    const input = screen.getByRole('textbox', {name: 'Name'}) as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    await user.click(input);
    expect(input).not.toHaveAttribute('readonly');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(8);
    await user.keyboard('Updated{Enter}');
    expect(save).toHaveBeenCalledExactlyOnceWith('Updated');
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveValue('Updated');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('readonly');
  });

  test('Tab focuses without editing; Enter starts editing and Escape cancels without saving on blur', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <>
        <InlineEdit label="Name" value="Original" onCommit={save} />
        <button>Next</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    await user.keyboard('{Enter}Changed{Escape}');
    expect(screen.getByRole('textbox')).toHaveValue('Original');
    expect(screen.getByRole('textbox')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', {name: 'Next'})).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
  });

  test('blur saves without stealing focus and unchanged values skip the callback', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <>
        <InlineEdit label="Name" value="Original" onCommit={save} />
        <button>Next</button>
      </>,
    );
    await user.click(screen.getByRole('textbox'));
    await user.tab();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('Changed');
    await user.tab();
    expect(save).toHaveBeenCalledExactlyOnceWith('Changed');
    expect(screen.getByRole('button')).toHaveFocus();
  });

  test('formatted currency edits raw numbers without replacing the input or its size classes', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const format = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format;
    function Example() {
      const [value, setValue] = React.useState(1234.5);
      return (
        <InlineEdit
          label="Budget"
          value={value}
          format={format}
          align="right"
          onCommit={next => {
            save(next);
            setValue(next);
          }}
        />
      );
    }
    const {container} = render(<Example />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveValue('$1,234.50');
    const classes = input.className.split(' ').filter(c => /ag-(h-|px-|text-)/.test(c));
    await user.click(input);
    expect(input).toHaveValue('1234.5');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input.className.split(' ').filter(c => /ag-(h-|px-|text-)/.test(c))).toEqual(classes);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('$1,234.50');
    await user.keyboard('-250.75{Enter}');
    expect(save).toHaveBeenCalledExactlyOnceWith(-250.75);
    expect(input).toHaveValue('-$250.75');
    expect(screen.getByRole('textbox')).toBe(input);
  });

  test('custom parsing supports localized currency and reports validation errors', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <InlineEdit
        label="Budget"
        value={12.5}
        format={new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format}
        toInputValue={value => value.toFixed(2).replace('.', ',')}
        parse={draft => {
          if (!/^-?\d+(,\d{1,2})?$/.test(draft)) throw new Error('Use a decimal comma.');
          return Number(draft.replace(',', '.'));
        }}
        onCommit={save}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toHaveValue('12,50');
    await user.keyboard('bad{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Use a decimal comma.');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(save).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '20,75{Enter}');
    expect(save).toHaveBeenCalledExactlyOnceWith(20.75);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test.each(['', 'abc', 'Infinity'])('rejects invalid numeric draft %j instead of saving zero/NaN', async draft => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<InlineEdit label="Amount" value={42} onCommit={save} />);
    await user.click(screen.getByRole('textbox'));
    await user.clear(screen.getByRole('textbox'));
    if (draft) await user.keyboard(draft);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid number.');
    expect(save).not.toHaveBeenCalled();
  });

  test('pending save prevents duplicate commits and cancellation; rejection preserves draft for retry', async () => {
    const user = userEvent.setup();
    let reject!: (reason: Error) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    const {container} = render(<InlineEdit label="Name" value="Original" onCommit={save} />);
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('Changed{Enter}{Enter}{Escape}');
    expect(save).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    await act(async () => {
      reject(new Error('Offline'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Offline');
    expect(screen.getByRole('textbox')).toHaveValue('Changed');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
    await user.keyboard('{Enter}');
    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('custom editor supports multiline drafts, explicit save/cancel and portalled controls', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <InlineEdit
        label="Description"
        value="Hello"
        onCommit={save}
        renderValue={value => <span>{value}</span>}
        renderEditor={({draft, setDraft, commit, cancel, label}) => (
          <>
            <textarea aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} />
            <button onClick={() => void commit()}>Save</button>
            <button onClick={cancel}>Cancel</button>
            {createPortal(<button>Formatting</button>, document.body)}
          </>
        )}
      />,
    );
    await user.click(screen.getByRole('button', {name: 'Edit Description'}));
    expect(screen.getByRole('textbox')).toHaveFocus();
    await user.type(screen.getByRole('textbox'), '{End}{Enter}World');
    await user.click(screen.getByRole('button', {name: 'Formatting'}));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('Hello\nWorld');
    await user.click(screen.getByRole('button', {name: 'Save'}));
    expect(save).toHaveBeenCalledExactlyOnceWith('Hello\nWorld');
    expect(screen.getByRole('button', {name: 'Edit Description'})).toHaveFocus();
    await user.click(screen.getByRole('button', {name: 'Edit Description'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: 'Edit Description'})).toHaveFocus();
  });

  test('opt-in custom blur commits only when focus leaves the wrapper', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <>
        <InlineEdit
          label="Name"
          value="A"
          onCommit={save}
          commitOnBlur
          renderEditor={({draft, setDraft}) => (
            <>
              <input aria-label="Name" value={draft} onChange={e => setDraft(e.target.value)} />
              <button>Inside</button>
            </>
          )}
        />
        <button>Outside</button>
      </>,
    );
    await user.click(screen.getByRole('button', {name: 'Edit Name'}));
    await user.type(screen.getByRole('textbox'), 'B');
    await user.click(screen.getByRole('button', {name: 'Inside'}));
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: 'Outside'}));
    expect(save).toHaveBeenCalledExactlyOnceWith('AB');
  });

  test('external updates preserve an active draft and cancellation shows the latest value', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const {rerender} = render(<InlineEdit label="Name" value="A" onCommit={save} />);
    rerender(<InlineEdit label="Name" value="B" onCommit={save} />);
    expect(screen.getByRole('textbox')).toHaveValue('B');
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('Draft');
    rerender(<InlineEdit label="Name" value="Remote" onCommit={save} />);
    expect(screen.getByRole('textbox')).toHaveValue('Draft');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox')).toHaveValue('Remote');
    expect(save).not.toHaveBeenCalled();
  });

  test('IME Enter and Escape do not save or cancel during composition', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<InlineEdit label="Name" value="A" onCommit={save} />);
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('Draft');
    fireEvent.keyDown(input, {key: 'Enter', isComposing: true});
    fireEvent.keyDown(input, {key: 'Escape', isComposing: true});
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveValue('Draft');
    expect(save).not.toHaveBeenCalled();
  });

  test('a custom display can use the default editor and select its editable value', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<InlineEdit label="Name" value="Hello" onCommit={save} renderValue={value => <strong>{value}</strong>} />);
    await user.click(screen.getByRole('button', {name: 'Edit Name'}));
    await user.keyboard('World{Enter}');
    expect(save).toHaveBeenCalledExactlyOnceWith('World');
    expect(screen.getByRole('button', {name: 'Edit Name'})).toHaveFocus();
  });

  test('disabled fields cannot edit; forwards the wrapper ref', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<HTMLDivElement>();
    const save = vi.fn();
    render(<InlineEdit ref={ref} label="Name" value="A" onCommit={save} disabled />);
    expect(ref.current?.tagName).toBe('DIV');
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(save).not.toHaveBeenCalled();
  });

  test('view, editing and validation error states have no axe violations', async () => {
    const user = userEvent.setup();
    render(<InlineEdit label="Amount" value={5} onCommit={() => {}} />);
    const check = async () => {
      const result = await axe.run(document.body, {
        rules: {'color-contrast': {enabled: false}, region: {enabled: false}},
      });
      expect(result.violations).toEqual([]);
    };
    await check();
    await user.click(screen.getByRole('textbox'));
    await check();
    await user.keyboard('bad{Enter}');
    await check();
  });
});
