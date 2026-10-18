import {describe, expect, test, vi} from 'vitest';
import * as React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Badge} from '../src/components/Badge';
import {Button} from '../src/components/Button';
import {ButtonToggle} from '../src/components/ButtonToggle';
import {Input} from '../src/components/Input';
import {PillOption} from '../src/components/PillOption';
import {Text} from '../src/components/Text';
import {Toggle} from '../src/components/Toggle';

describe('Button', () => {
  test('renders children and honors disabled', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', {name: 'Save'});
    expect(button).toBeDefined();
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  test('color accepts an Airtable color name and resolves to hex', () => {
    render(<Button color="blueBright">Go</Button>);
    const button = screen.getByRole('button', {name: 'Go'});
    expect(button.style.color).toBe('rgb(45, 127, 249)'); // #2d7ff9
  });

  test('color accepts raw hex and arbitrary CSS colors', () => {
    render(<Button color="#ff0000">A</Button>);
    expect(screen.getByRole('button', {name: 'A'}).style.color).toBe('rgb(255, 0, 0)');

    render(<Button color="rebeccapurple">B</Button>);
    expect(screen.getByRole('button', {name: 'B'}).style.color).toBe('rebeccapurple');
  });
  test.each(['outline', 'secondary', 'ghost'] as const)('%s pairs every light background and text color with a dark one', variant => {
    render(
      <Button variant={variant} aria-label={variant}>
        x
      </Button>,
    );
    const classes = screen.getByRole('button', {name: variant}).className.split(/\s+/);
    const light = classes.filter(c => /^(hover:)?ag-(bg|text)-neutral-|^ag-bg-white$/.test(c));
    expect(light.length).toBeGreaterThan(0);
    for (const c of light) {
      const [, state = '', kind] = /^(hover:)?ag-(bg|text)-/.exec(c)!;
      expect(classes.some(d => d.startsWith(`dark:${state}ag-${kind}-`)), `${c} has no dark counterpart`).toBe(true);
    }
  });
});

describe('Text', () => {
  test('forwards its ref to the DOM node (React 17 floor regression)', () => {
    const ref = React.createRef<HTMLElement>();
    render(<Text ref={ref}>hello</Text>);
    expect(ref.current).not.toBe(null);
    expect(ref.current!.tagName).toBe('P');
  });

  test('heading variant defaults to h3; `as` overrides', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <Text ref={ref} variant="heading">
        title
      </Text>,
    );
    expect(ref.current!.tagName).toBe('H3');

    const spanRef = React.createRef<HTMLElement>();
    render(
      <Text ref={spanRef} as="span">
        inline
      </Text>,
    );
    expect(spanRef.current!.tagName).toBe('SPAN');
  });
});

describe('Toggle', () => {
  test('is a switch and toggles on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);

    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Badge', () => {
  test('null opts renders the invalid fallback without throwing (regression)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Badge opts={null} />);
    expect(screen.getByText('Invalid')).toBeDefined();
    spy.mockRestore();
  });

  test('a name-only option renders a neutral pill that has a dark variant', () => {
    render(<Badge opts={{name: 'Draft'}} />);
    const pill = screen.getByTitle('Draft');
    expect(pill.style.backgroundColor).toBe('');
    expect(pill.className).toContain('ag-bg-[#eeeeee]');
    expect(pill.className).toContain('dark:ag-bg-[rgba(195,212,249,0.18)]');
  });

  test('stays on one line and truncates instead of wrapping', () => {
    render(<Badge opts={{name: 'Custo de Serviços (CoS)', color: 'purpleLight2'}} />);
    const pill = screen.getByTitle('Custo de Serviços (CoS)');
    expect(pill.className).toContain('ag-whitespace-nowrap');
    expect(pill.className).toContain('ag-max-w-full');
    expect(screen.getByText('Custo de Serviços (CoS)').className).toContain('ag-truncate');
  });

  test('a colored option resolves its Airtable color', () => {
    render(<Badge opts={{name: 'Live', color: 'blueBright'}} />);
    const pill = screen.getByTitle('Live');
    expect(pill.style.backgroundColor).toBe('rgb(45, 127, 249)');
    expect(pill.style.color).toBe('rgb(255, 255, 255)'); // light text per SDK table
  });
});

describe('PillOption', () => {
  test('a colorless pill (a linked record) uses the neutral classes, so dark mode repaints it', () => {
    render(<PillOption opt={{value: 'rec1', label: 'Devolução'}} />);
    const pill = screen.getByTitle('Devolução');
    expect(pill.style.background).toBe('');
    expect(pill.className).toContain('dark:ag-bg-[rgba(195,212,249,0.18)]');
    expect(pill.className).toContain('dark:ag-text-white');
  });

  test('a colored pill keeps its inline color and no neutral classes', () => {
    render(<PillOption opt={{value: 'a', label: 'Live', color: 'blueBright'}} />);
    const pill = screen.getByTitle('Live');
    expect(pill.style.background).toBe('rgb(45, 127, 249)');
    expect(pill.className).not.toContain('dark:ag-bg-');
  });
});

describe('Input', () => {
  test('uncontrolled typing reports each change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input onChange={onChange} aria-label="name" />);

    await user.type(screen.getByRole('textbox', {name: 'name'}), 'hi');
    expect(onChange).toHaveBeenLastCalledWith('hi');
  });

  test('controlled value renders and updates via prop', () => {
    const {rerender} = render(<Input value="a" onChange={() => {}} aria-label="v" />);
    const input = screen.getByRole('textbox', {name: 'v'}) as HTMLInputElement;
    expect(input.value).toBe('a');

    rerender(<Input value="b" onChange={() => {}} aria-label="v" />);
    expect(input.value).toBe('b');
  });
});

describe('ButtonToggle', () => {
  test('boolean mode toggles and exposes aria-pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ButtonToggle checked={false} onChange={onChange} />);

    const button = screen.getByRole('button', {name: 'Off'});
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await user.click(button);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('multi-option mode cycles through options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const options = [
      {value: 'a', label: 'A'},
      {value: 'b', label: 'B'},
    ];
    render(<ButtonToggle options={options} value="b" onChange={onChange} />);

    await user.click(screen.getByRole('button', {name: 'B'}));
    expect(onChange).toHaveBeenCalledWith('a'); // wraps around
  });

  test('invalid value warns and renders null instead of throwing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {container} = render(
      <ButtonToggle options={[{value: 'a', label: 'A'}]} value="nope" onChange={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
