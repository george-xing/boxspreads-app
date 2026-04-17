import { useEffect, useRef, useState } from "react";

/**
 * Observes a source element's height via `ResizeObserver` and returns it so
 * callers can size a second element to match. Returns `undefined` when the
 * provided media query does not match (e.g. mobile), letting callers skip the
 * inline height on narrow viewports where the layout stacks.
 *
 * Used by the Calculator to make the left-column panel (chart + scrollable
 * expiration table) exactly as tall as the right-column Configure panel,
 * eliminating the white space on the right side of the grid.
 */
export function useMatchHeight(
  sourceRef: React.RefObject<HTMLElement | null>,
  mediaQuery = "(min-width: 768px)",
): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  // Hold the observer in a ref so we can detach/reattach on MQ change without
  // tearing down the outer effect (which would cause extra re-renders).
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = sourceRef.current;
    if (!el || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }

    const mq = window.matchMedia(mediaQuery);

    const attach = () => {
      if (!mq.matches) {
        setHeight(undefined);
        return;
      }
      observerRef.current = new ResizeObserver((entries) => {
        const h = entries[0]?.contentRect.height;
        if (h && h > 0) setHeight(h);
      });
      observerRef.current.observe(el);
    };

    const detach = () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
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
  }, [sourceRef, mediaQuery]);

  return height;
}
