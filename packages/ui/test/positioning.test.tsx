import * as React from 'react';
import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest';
import {render, act} from '@testing-library/react';
import {useAnchoredPosition, type AnchoredPositionOptions, type AnchoredPositionResult} from '../src/positioning.js';

function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  const full = {top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...rect};
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(full as DOMRect);
}

function mockSize(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'offsetWidth', {value: width, configurable: true});
  Object.defineProperty(el, 'offsetHeight', {value: height, configurable: true});
}

function setViewport({innerWidth = 1024, innerHeight = 768, clientWidth = innerWidth}: {innerWidth?: number; innerHeight?: number; clientWidth?: number}) {
  Object.defineProperty(window, 'innerWidth', {value: innerWidth, configurable: true});
  Object.defineProperty(window, 'innerHeight', {value: innerHeight, configurable: true});
  Object.defineProperty(document.documentElement, 'clientWidth', {value: clientWidth, configurable: true});
}

/** Renders the hook against real (jsdom) anchor/content nodes with mocked geometry. */
function setup(options: Partial<AnchoredPositionOptions> & {anchorRect: Partial<DOMRect>; contentSize?: [number, number]}) {
  const {anchorRect, contentSize, ...hookOptions} = options;
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  mockRect(anchor, anchorRect);
  const anchorRef = {current: anchor};

  let contentRef: React.RefObject<HTMLElement | null> | undefined;
  if (contentSize) {
    const content = document.createElement('div');
    document.body.appendChild(content);
    mockSize(content, contentSize[0], contentSize[1]);
    contentRef = {current: content};
  }

  const {open: initialOpen = true, ...staticOptions} = hookOptions;
  const result: {current: AnchoredPositionResult | null} = {current: null};
  function Harness(props: {open: boolean}) {
    result.current = useAnchoredPosition({
      ...staticOptions,
      open: props.open,
      anchorRef,
      contentRef,
    });
    return null;
  }
  const view = render(<Harness open={initialOpen} />);
  return {result, view, anchor, content: contentRef?.current ?? null, Harness};
}

beforeEach(() => {
  setViewport({});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useAnchoredPosition — anchor-only mode', () => {
  const anchorRect = {top: 100, bottom: 130, left: 200, right: 350, width: 150, height: 30};

  it('positions below the anchor with the default offset and matches width', () => {
    const {result} = setup({open: true, anchorRect, matchAnchorWidth: true});
    expect(result.current!.style).toMatchObject({position: 'fixed', top: 136, left: 200, width: 150});
    expect(result.current!.ready).toBe(true);
    expect(result.current!.anchorWidth).toBe(150);
  });

  it('align end anchors to the right edge using clientWidth, not innerWidth', () => {
    // innerWidth includes a 15px scrollbar that clientWidth excludes; fixed
    // `right` resolves against the layout viewport (clientWidth).
    setViewport({innerWidth: 1024, clientWidth: 1009});
    const {result} = setup({open: true, anchorRect, align: 'end'});
    expect(result.current!.style.right).toBe(1009 - 350);
    expect(result.current!.style.left).toBeUndefined();
  });

  it('update() measures before the floating element exists', () => {
    const {result} = setup({open: false, anchorRect});
    expect(result.current!.ready).toBe(false);
    act(() => result.current!.update());
    expect(result.current!.ready).toBe(true);
    expect(result.current!.style.top).toBe(136);
  });

  it('repositions on capture-phase scroll while open and stops when closed', () => {
    const {result, anchor, view, Harness} = setup({open: true, anchorRect});
    mockRect(anchor, {...anchorRect, bottom: 90, right: 350});
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current!.style.top).toBe(96);

    view.rerender(<Harness open={false} />);
    mockRect(anchor, {...anchorRect, bottom: 300});
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current!.style.top).toBe(96); // unchanged: listener removed
  });
});

describe('useAnchoredPosition — content mode', () => {
  const anchorRect = {top: 300, bottom: 330, left: 400, right: 500, width: 100, height: 30};

  it('side bottom + align center centers the content under the anchor', () => {
    const {result} = setup({open: true, anchorRect, contentSize: [200, 100], side: 'bottom', align: 'center', offset: 8});
    expect(result.current!.style.top).toBe(338);
    expect(result.current!.style.left).toBe(400 + (100 - 200) / 2);
    expect(result.current!.style.transformOrigin).toBe('top center');
  });

  it('side top places content above; side right/left place it beside', () => {
    const top = setup({open: true, anchorRect, contentSize: [200, 100], side: 'top', align: 'start', offset: 8});
    expect(top.result.current!.style.top).toBe(300 - 100 - 8);
    expect(top.result.current!.style.left).toBe(400);
    expect(top.result.current!.style.transformOrigin).toBe('bottom left');

    const right = setup({open: true, anchorRect, contentSize: [200, 100], side: 'right', align: 'start', offset: 8});
    expect(right.result.current!.style.left).toBe(508);
    expect(right.result.current!.style.top).toBe(300);
  });

  it('clamps into the viewport with collisionPadding when not flipping', () => {
    const {result} = setup({
      open: true,
      anchorRect: {top: 10, bottom: 40, left: 5, right: 105, width: 100, height: 30},
      contentSize: [300, 100],
      side: 'top',
      align: 'start',
      collisionPadding: 8,
    });
    // side top would be negative -> clamped to padding
    expect(result.current!.style.top).toBe(8);
    expect(result.current!.style.left).toBe(8);
  });

  it('flips to the opposite side only when flip is enabled and the other side fits', () => {
    const nearBottom = {top: 700, bottom: 730, left: 400, right: 500, width: 100, height: 30};
    const noFlip = setup({open: true, anchorRect: nearBottom, contentSize: [200, 100], side: 'bottom'});
    expect(noFlip.result.current!.placedSide).toBe('bottom');
    expect(noFlip.result.current!.style.top).toBe(768 - 100 - 8); // clamped

    const flipped = setup({open: true, anchorRect: nearBottom, contentSize: [200, 100], side: 'bottom', flip: true});
    expect(flipped.result.current!.placedSide).toBe('top');
    expect(flipped.result.current!.style.top).toBe(700 - 100 - 6);
    expect(flipped.result.current!.style.transformOrigin).toBe('bottom left');
  });

  it('ready persists through close so exit animations keep their position', () => {
    const {result, view, Harness} = setup({open: true, anchorRect, contentSize: [200, 100]});
    expect(result.current!.ready).toBe(true);
    const openStyle = result.current!.style;
    view.rerender(<Harness open={false} />);
    expect(result.current!.ready).toBe(true);
    expect(result.current!.style).toEqual(openStyle);
  });

  it('observes content resize when ResizeObserver exists', () => {
    const observed: Element[] = [];
    const disconnect = vi.fn();
    class RO {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', RO);
    const {view, content} = setup({open: true, anchorRect, contentSize: [200, 100]});
    expect(observed).toContain(content);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not crash when ResizeObserver is absent', () => {
    const original = globalThis.ResizeObserver;
    // @ts-expect-error simulating older environment
    delete globalThis.ResizeObserver;
    try {
      const {result} = setup({open: true, anchorRect, contentSize: [200, 100]});
      expect(result.current!.ready).toBe(true);
    } finally {
      if (original) globalThis.ResizeObserver = original;
    }
  });
});
