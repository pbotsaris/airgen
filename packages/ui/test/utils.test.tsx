import {describe, expect, test, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {clamp, cx, mergeRefs, useControllableState, useBlurState} from '../src/utils';

describe('cx', () => {
  test('joins truthy values and drops the rest', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('clamp', () => {
  test('clamps to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('mergeRefs', () => {
  test('writes to object refs and calls function refs', () => {
    const objectRef = {current: null as HTMLElement | null};
    const fnRef = vi.fn();
    const el = document.createElement('div');

    mergeRefs<HTMLElement>(objectRef, fnRef, null, undefined)(el);

    expect(objectRef.current).toBe(el);
    expect(fnRef).toHaveBeenCalledWith(el);
  });
});

describe('useControllableState', () => {
  test('uncontrolled: manages its own state and reports changes', () => {
    const onChange = vi.fn();
    const {result} = renderHook(() => useControllableState({defaultValue: 'a', onChange}));

    act(() => result.current[1]('b'));

    expect(result.current[0]).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  test('controlled: reflects the prop and never drifts internally', () => {
    const onChange = vi.fn();
    const {result, rerender} = renderHook(
      ({value}) => useControllableState({value, defaultValue: 'a', onChange}),
      {initialProps: {value: 'x'}},
    );

    act(() => result.current[1]('y'));

    // still shows the controlled value until the parent re-renders with it
    expect(result.current[0]).toBe('x');
    expect(onChange).toHaveBeenCalledWith('y');

    rerender({value: 'y'});
    expect(result.current[0]).toBe('y');
  });
});

describe('useBlurState', () => {
  test('defers onChange to blur; a blur after the external value caught up is a no-op', () => {
    const onChange = vi.fn();
    const {result, rerender} = renderHook(({value}) => useBlurState({value, defaultValue: '', onChange}), {
      initialProps: {value: ''},
    });

    act(() => result.current.setState('typed'));
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.onBlur());
    expect(onChange).toHaveBeenCalledWith('typed');

    // the external save lands, the prop catches up — further blurs are no-ops
    onChange.mockClear();
    rerender({value: 'typed'});
    act(() => result.current.onBlur());
    expect(onChange).not.toHaveBeenCalled();
  });
});
