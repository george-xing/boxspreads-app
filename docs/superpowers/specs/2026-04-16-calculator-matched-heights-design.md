# Calculator layout — matched heights, scrollable expiration table

## Problem

The calculator's main grid has two columns that fight each other:

- **Left** (`2fr`) — yield-curve chart + 30-row expiration table. Natural height ≈ 900px.
- **Right** (`1fr`) — Configure / Tax rates / Estimated rates / Summary. Natural height ≈ 500px.

CSS grid's default `align-items: stretch` makes both columns match the taller one, so the right panel inherits ~400px of white space and the left shows all 30 rows, forcing the user to scroll the page to reach the order/summary area. The problem gets worse in the connected view, which adds the candidates panel and order sections below.

## Goal

The two columns end at the same vertical pixel — no white space at the bottom of either. The right panel's natural content height determines the grid row height. The left column's table scrolls within whatever vertical space remains after the chart.

## Non-goals

- No changes to right-panel content, copy, or section structure (user chose option 3: keep as is).
- No changes to the yield-curve chart itself.
- No changes to the `ExpirationTable` rendering — it already has `overflow-y-auto` and `flex-1 min-h-0`; they just never engaged because the parent had no bounded height.
- No new layout on mobile — below the `md` breakpoint the grid already stacks vertically; keep that behavior and do not apply the height-matching there.

## Approach

Use a `ResizeObserver` on the right panel to measure its rendered height, then apply that height to the left panel via inline style. Inside the left panel, the existing flexbox plumbing takes over:

- Chart container: `shrink-0` (fixed ~180px)
- Divider: fixed
- Table wrapper: `flex-1 min-h-0 overflow-y-auto` — naturally consumes the remaining space and scrolls when the 30 rows don't fit.

The approach is CSS-light and stays inside React: no subgrid, no layout library, no hard-coded heights.

### Why not pure CSS

- `grid-template-rows: min-content` with `overflow-auto` in the left child doesn't reliably produce "right drives height" across browsers when the grid has no explicit height.
- Subgrid would help structure, but not solve the "which column drives" question.
- Hardcoding `max-h-[calc(100vh-Xpx)]` on the grid caps the whole thing to viewport but creates *new* white space on the right in tall viewports and still leaves white space when the right content is shorter than the cap.

JS measurement is the only approach that correctly answers "match the right panel's intrinsic height, whatever it is" across both disconnected and connected modes without magic numbers.

### Why not match max(left, right)

We always want right to drive. If the right panel's content is ever shorter than chart+table-min-height, letting left drive would reintroduce white space on the right — the original problem. When right is shorter than the chart + a sensible minimum table area, the table simply has fewer visible rows and scrolls more; that is the correct behavior.

## Implementation sketch

### New hook: `useMatchHeight`

```ts
// src/components/calculator/useMatchHeight.ts
import { useEffect, useRef, useState } from "react";

/**
 * Observes `sourceRef`'s height and returns it, so a target element can be
 * sized to match. Returns `undefined` when the media query doesn't match,
 * letting callers skip the style on mobile where the grid stacks.
 */
export function useMatchHeight(sourceRef: React.RefObject<HTMLElement | null>, mediaQuery = "(min-width: 768px)") {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = sourceRef.current;
    if (!el) return;

    const mq = window.matchMedia(mediaQuery);
    let ro: ResizeObserver | null = null;

    const attach = () => {
      if (!mq.matches) { setHeight(undefined); return; }
      ro = new ResizeObserver((entries) => {
        const h = entries[0]?.contentRect.height;
        if (h) setHeight(h);
      });
      ro.observe(el);
    };

    attach();
    const onChange = () => { ro?.disconnect(); ro = null; attach(); };
    mq.addEventListener("change", onChange);
    return () => {
      ro?.disconnect();
      mq.removeEventListener("change", onChange);
    };
  }, [sourceRef, mediaQuery]);

  return height;
}
```

### Calculator.tsx wiring

```tsx
const rightPanelRef = useRef<HTMLDivElement>(null);
const matchedHeight = useMatchHeight(rightPanelRef);

// ...

<div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-5 items-start">
  <div
    className="rounded-xl border border-gray-300 bg-white p-5 flex flex-col overflow-hidden"
    style={matchedHeight ? { height: matchedHeight } : undefined}
  >
    {/* chart (shrink-0) + divider + table (flex-1 min-h-0 overflow-y-auto) */}
  </div>
  <div
    ref={rightPanelRef}
    className="rounded-xl border border-gray-300 bg-white p-5 space-y-3"
  >
    {/* unchanged right-panel content */}
  </div>
</div>
```

Key changes:

1. Add `items-start` to the grid (prevents grid stretch, lets right panel be its natural height).
2. Add `overflow-hidden` to the left panel so the chart + table respect the bounded height.
3. Add `style={{ height: matchedHeight }}` on the left panel, driven by the hook.
4. The hook returns `undefined` below `md`, so mobile keeps its current stacked, natural-height behavior.

### Files touched

- `src/components/calculator/useMatchHeight.ts` — NEW
- `src/components/calculator/Calculator.tsx` — wire up ref + hook + inline style on left panel, add `items-start` on the grid

No other files need changes. `ExpirationTable.tsx` already has the scroll plumbing.

## Edge cases

- **Right panel is shorter than the chart.** The left column's min-content is chart (~180px) + table min-content (0 because of `overflow`). When `matchedHeight < chart height`, the chart would overflow. Mitigation: the chart container uses `min-h-[180px] shrink-0`, so the browser lets the left panel exceed the matched height if the chart needs it. In practice the right panel is always taller than 180px once it renders its four sections. Accept this as safe.
- **Right panel content changes (e.g., candidates load).** `ResizeObserver` fires, the hook updates state, the left panel's height prop updates, the table's visible row count adjusts. Verified via the connected mockup.
- **Mobile (below `md`).** The grid already becomes `grid-cols-1` (stacked). The hook returns `undefined` in that case, so no inline height is applied, and the table shows all rows naturally. No double-scroll on mobile.
- **SSR.** `useMatchHeight` only runs client-side (it touches `window.matchMedia`). The initial server render matches the current behavior (no inline height); the first client paint may briefly show the un-matched layout before `ResizeObserver` fires. This is imperceptible and matches how the rest of the Calculator handles SSR.
- **Resize flicker.** `ResizeObserver` batches; React's re-render from `setHeight` is fast. Observed via the mockup — no visible flicker when resizing the viewport.
- **Treasury-rate empty state.** When FRED is down the left panel shows the "data unavailable" empty-state block instead of chart + table. That block is short and *will* get stretched by the matched height, creating white space inside the left panel. Acceptable — this is a rare error state and looks no worse than the chart-plus-blank-table case. Do not special-case it.

## Testing

- **Visual regression (manual):**
  - Disconnected view: bottoms of left and right panels align; table scrolls.
  - Connected view: candidates load → right panel grows → table visible area grows correspondingly, still aligned at bottom.
  - Resize browser window: heights re-match without flicker.
  - Mobile width: grid stacks, table shows all rows, no inline height applied.
  - FRED down (disconnected with empty-state): no crash, some white space inside the left panel is acceptable.
- **Unit test for the hook** (vitest + jsdom): mock `ResizeObserver` and `matchMedia`, verify the hook returns the observed height when the MQ matches and `undefined` when it doesn't.
- **Existing 98 tests** must still pass — this change is additive and doesn't touch calculation logic.

## Rollout

Single commit, no feature flag. Low risk because it's purely visual and falls back gracefully (if `ResizeObserver` is missing or the hook errors, the layout reverts to today's behavior — white space on the right but no broken UI).
