import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useMatchHeight } from "@/components/calculator/useMatchHeight";

// Minimal ResizeObserver mock that lets the test trigger height updates.
type MockObserverCb = (entries: Array<{ contentRect: { height: number } }>) => void;
const observers: Array<{ cb: MockObserverCb; target: Element | null }> = [];

class MockResizeObserver {
  private cb: MockObserverCb;
  private target: Element | null = null;
  constructor(cb: MockObserverCb) {
    this.cb = cb;
    observers.push({ cb, target: null });
  }
  observe(el: Element) {
    this.target = el;
    observers[observers.length - 1]!.target = el;
  }
  disconnect() {
    const i = observers.findIndex((o) => o.cb === this.cb);
    if (i >= 0) observers.splice(i, 1);
  }
  unobserve() {}
}

function triggerResize(height: number) {
  // Fire all currently-attached observers with the new height.
  for (const { cb } of observers) {
    cb([{ contentRect: { height } }]);
  }
}

// matchMedia mock with change-event support.
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

describe("useMatchHeight", () => {
  beforeEach(() => {
    observers.length = 0;
    (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
      MockResizeObserver;
  });
  afterEach(() => {
    observers.length = 0;
  });

  it("returns the observed height when the media query matches", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      // Populate the ref with a throwaway element so the observer attaches.
      if (!ref.current) ref.current = document.createElement("div");
      return useMatchHeight(ref);
    });

    expect(result.current).toBeUndefined();
    act(() => { triggerResize(512); });
    expect(result.current).toBe(512);

    act(() => { triggerResize(640); });
    expect(result.current).toBe(640);
  });

  it("returns undefined when the media query does not match (mobile)", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      if (!ref.current) ref.current = document.createElement("div");
      return useMatchHeight(ref);
    });

    // No observer should have been attached at all.
    expect(observers.length).toBe(0);
    expect(result.current).toBeUndefined();
  });

  it("detaches when the media query stops matching", () => {
    const mql = installMatchMedia(true);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      if (!ref.current) ref.current = document.createElement("div");
      return useMatchHeight(ref);
    });

    act(() => { triggerResize(500); });
    expect(result.current).toBe(500);

    act(() => { mql.dispatch(false); });
    // Dropping below the MQ clears the cached height so the consumer
    // falls back to natural (stacked) layout.
    expect(result.current).toBeUndefined();
    expect(observers.length).toBe(0);
  });
});
