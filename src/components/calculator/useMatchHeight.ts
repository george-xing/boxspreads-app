import { useEffect, useState } from "react";

/**
 * Observes a source element's height via `ResizeObserver` and returns it so
 * callers can size a second element to match. Returns `undefined` when the
 * provided media query does not match (e.g. mobile), letting callers skip the
 * inline height on narrow viewports where the layout stacks.
 *
 * Pass the element (not a ref) — typically from `useState<HTMLElement|null>`
 * attached via a callback ref. Using state (rather than `useRef`) means the
 * element identity change triggers the effect to re-run when the element
 * mounts, which matters in trees that have a "mounted" gate and initially
 * render a placeholder tree before attaching the real refs.
 *
 * Used by the Calculator to make the left-column panel (chart + scrollable
 * expiration table) exactly as tall as the right-column Configure panel,
 * eliminating the white space on the right side of the grid.
 */
export function useMatchHeight(
  el: HTMLElement | null,
  mediaQuery = "(min-width: 768px)",
): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!el || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }

    const mq = window.matchMedia(mediaQuery);
    let observer: ResizeObserver | null = null;

    const attach = () => {
      if (!mq.matches) {
        setHeight(undefined);
        return;
      }
      // We apply `height: Npx` to the consumer element, which (under
      // `box-sizing: border-box` — Tailwind's default) refers to the
      // border box. So we read offsetHeight, which is also border-box.
      // Mixing contentRect (content-box) here would undershoot by the
      // padding + border of the observed element.
      const measure = () => el.offsetHeight;

      const initial = measure();
      if (initial > 0) setHeight(initial);

      observer = new ResizeObserver(() => {
        const h = measure();
        if (h > 0) setHeight(h);
      });
      observer.observe(el);
    };

    const detach = () => {
      observer?.disconnect();
      observer = null;
    };

    attach();

    const onMqChange = () => {
      detach();
      attach();
    };
    mq.addEventListener("change", onMqChange);

    return () => {
      detach();
      mq.removeEventListener("change", onMqChange);
    };
  }, [el, mediaQuery]);

  return height;
}
