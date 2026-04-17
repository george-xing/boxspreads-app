import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMatchHeight } from "@/components/calculator/useMatchHeight";

// Minimal ResizeObserver mock that lets the test trigger height updates.
type MockObserverCb = (entries: Array<{ contentRect: { height: number } }>) => void;
const observers: Array<{ cb: MockObserverCb; target: Element | null }> = [];

class MockResizeObserver {
  private cb: MockObserverCb;
  constructor(cb: MockObserverCb) {
    this.cb = cb;
    observers.push({ cb, target: null });
  }
  observe(el: Element) {
    observers[observers.length - 1]!.target = el;
  }
  disconnect() {
    const i = observers.findIndex((o) => o.cb === this.cb);
    if (i >= 0) observers.splice(i, 1);
  }
  unobserve() {}
}

function triggerResize(height: number) {
  // The hook ignores ResizeObserver's entry payload and re-reads offsetHeight,
  // so update each observed element's stubbed offsetHeight before firing.
  for (const { cb, target } of observers) {
    if (target && (target as unknown as { __setHeight?: (n: number) => void }).__setHeight) {
      (target as unknown as { __setHeight: (n: number) => void }).__setHeight(height);
    }
    cb([{ contentRect: { height } }]);
  }
}

function installMatchMedia(matches: boolean) {
  const listeners: Array<(ev: { matches: boolean }) => void> = [];
  const mql = {
    matches,
    addEventListener: (_type: string, cb: (ev: { matches: boolean }) => void) => listeners.push(cb),
    removeEventListener: (_type: string, cb: (ev: { matches: boolean }) => void) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch: (next: boolean) => {
      mql.matches = next;
      for (const cb of listeners) cb({ matches: next });
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
}

function makeEl(initialHeight: number): HTMLDivElement {
  const el = document.createElement("div");
  // jsdom doesn't lay out, so stub offsetHeight (what useMatchHeight reads
  // for border-box-consistent measurements).
  let h = initialHeight;
  Object.defineProperty(el, "offsetHeight", {
    configurable: true,
    get: () => h,
  });
  (el as unknown as { __setHeight: (next: number) => void }).__setHeight = (next: number) => { h = next; };
  return el;
}

describe("useMatchHeight", () => {
  beforeEach(() => {
    observers.length = 0;
    (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
      MockResizeObserver;
  });
  afterEach(() => {
    observers.length = 0;
  });

  it("returns undefined when element is null", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMatchHeight(null));
    expect(result.current).toBeUndefined();
    expect(observers.length).toBe(0);
  });

  it("seeds height from getBoundingClientRect and updates on resize", () => {
    installMatchMedia(true);
    const el = makeEl(480);
    const { result } = renderHook(() => useMatchHeight(el));

    // Seed value from the initial measurement.
    expect(result.current).toBe(480);

    act(() => { triggerResize(612); });
    expect(result.current).toBe(612);
  });

  it("returns undefined when the media query does not match (mobile)", () => {
    installMatchMedia(false);
    const el = makeEl(500);
    const { result } = renderHook(() => useMatchHeight(el));

    expect(observers.length).toBe(0);
    expect(result.current).toBeUndefined();
  });

  it("detaches when the media query stops matching", () => {
    const mql = installMatchMedia(true);
    const el = makeEl(500);
    const { result } = renderHook(() => useMatchHeight(el));

    expect(result.current).toBe(500);

    act(() => { mql.dispatch(false); });
    expect(result.current).toBeUndefined();
    expect(observers.length).toBe(0);
  });

  it("re-attaches when the element changes (the bug we fixed)", () => {
    // The previous API used a ref object with stable identity, so mutating
    // ref.current from null to an element did not re-run the effect. With
    // the element-as-argument API the effect re-runs when the element
    // identity changes.
    installMatchMedia(true);
    const { result, rerender } = renderHook(
      ({ el }: { el: HTMLElement | null }) => useMatchHeight(el),
      { initialProps: { el: null as HTMLElement | null } },
    );

    expect(result.current).toBeUndefined();
    expect(observers.length).toBe(0);

    const el = makeEl(400);
    rerender({ el });

    expect(result.current).toBe(400);
    expect(observers.length).toBe(1);
  });
});
