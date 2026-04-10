# Two-Column Layout — Implementation Plan

Spec: `docs/superpowers/specs/2026-04-09-two-column-layout-design.md`

## Codex review resolutions

These clarifications resolve ambiguities found during plan review:

- **Amount change resets override.** Changing amount sets `userMidPrice = null` so the estimate recalculates cleanly. The "est." badge reappears. Same as expiration change.
- **YieldCurve gets a wrapper div** in Calculator.tsx for flex sizing. The component itself keeps its SVG internals but removes the fixed `style={{ height }}`. Parent div controls height via `flex-1 min-h-[200px]`.
- **Sticky header approach.** The entire `<table>` container scrolls (`max-h-[180px] overflow-y-auto` on the wrapper div). `<thead>` gets `sticky top-0` with background color. This works because sticky position is relative to the scroll container.
- **Fees always use IBKR rates** (they're identical across brokerages per `constants.ts`). `selectedBrokerage` only controls which guide expands — not fee calculation.
- **TaxRateInputs stays extracted.** It has internal focus/formatting state. Calculator renders `<TaxRateInputs />` in the after-tax sub-section, not inlined JSX.
- **AmountInput is the sole amount control.** `UnifiedCalculator` does NOT include an amount field. It only has strike width and mid price.

## Step 1: Simplify state — remove direction, rate editing, commission editing

**Files:** `src/components/calculator/Calculator.tsx`

- Remove `direction` state. Hardcode `"borrow"` in `buildBoxLegs` call.
- Remove `userRate` state and `handleRateChange`. Rate is always derived: `calcRateFromMid(activeMidPrice, strikeWidth, dte)`.
- Remove `commission` state. Use `BROKERAGE_FEES.ibkr` directly.
- Replace `isUserRate` with derived `const isUserOverride = userMidPrice !== null`.
- Add `selectedBrokerage` state: `useState<Brokerage | null>(null)`.
- `handleAmountChange`: reset `userMidPrice` to `null` (same as expiration change).
- `handleExpiryChange`: already resets `userMidPrice` to `null`.

**Verify:** `npx tsc --noEmit` passes. `npx vitest run` passes.

## Step 2: Update child components

**Files:**

**`src/components/calculator/UnifiedCalculator.tsx`**
- Remove: direction toggle, expiration dropdown, rate input field, commission field.
- Keep: strike width field, mid price field (with "est." badge driven by `isUserOverride` prop).
- Add: "Reset to estimate" link (shown when `isUserOverride`).
- Simplified props: `strikeWidth, onStrikeWidthChange, midPrice, onMidPriceChange, isUserOverride, onResetEstimate`.

**`src/components/calculator/AmountInput.tsx`**
- Add `compact?: boolean` prop.
- When `compact`: inline layout (label left, input right, same row), smaller text, no hero sizing.
- Default (non-compact): unchanged (used nowhere currently, but preserved).

**`src/components/calculator/ExpirationTable.tsx`**
- The component renders a `<div>` wrapping a `<table>`. Add `max-h-[180px] overflow-y-auto` to that wrapper.
- Add `sticky top-0 bg-gray-900` classes to `<thead><tr>`.

**`src/components/calculator/YieldCurve.tsx`**
- Remove fixed `style={{ height: 220 }}` from the SVG element.
- Change SVG to `className="w-full h-full"` with `preserveAspectRatio="xMidYMid meet"`.
- Remove the outer wrapper div. Parent in Calculator.tsx controls sizing.

**`src/components/order/OrderParams.tsx`**
- Remove `direction` prop. Hardcode borrow labels.
- Change grid from `grid-cols-2` to `grid-cols-1 md:grid-cols-2`.

**`src/components/order/BrokerageGuide.tsx`**
- Append PreSubmitChecklist content (warning + fill tip) at the bottom of the IBKR guide.

**`src/components/order/LegTable.tsx`**
- Wrap the table in `overflow-x-auto` for mobile.

**Verify:** `npx tsc --noEmit` passes.

## Step 3: Create BrokerageCTA component

**File:** `src/components/calculator/BrokerageCTA.tsx` (new)

```typescript
interface BrokerageCTAProps {
  selected: Brokerage | null;
  onSelect: (b: Brokerage) => void;
}
```

- Heading: "Enter this order at your brokerage"
- Subheading: "Step-by-step guide with your exact order values"
- 3 buttons in `flex flex-col md:flex-row gap-2`:
  - IBKR: clickable, `→` arrow, hover border-green, selected = green border
  - Schwab: disabled, "soon" label, muted
  - Fidelity: disabled, "soon" label, muted
- Plain `<button>` elements, no gradients

**Verify:** `npx tsc --noEmit` passes.

## Step 4: Rewrite Calculator.tsx render — two-column layout

**File:** `src/components/calculator/Calculator.tsx`

Main integration step. Structure:

```jsx
<div className="space-y-4">
  {/* Heading */}

  {/* Two-column grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    {/* LEFT: chart + table */}
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col">
      <div className="flex-1 min-h-[200px]">
        <YieldCurve ... />
      </div>
      <div className="border-t border-gray-700 pt-3 mt-3">
        <ExpirationTable ... />  {/* scrollable internally */}
      </div>
    </div>

    {/* RIGHT: calculator */}
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      {/* Configure sub-section */}
      <AmountInput compact value={amount} onChange={handleAmountChange} />
      <div>Expiration: {label} ({dte}d)</div>
      <UnifiedCalculator ... />  {/* strike width + mid price */}

      {/* Rate result sub-section (inline) */}
      <div className="border-t">
        <div className="text-4xl text-green-400">{rate}%</div>
        <div>{isUserOverride ? "your rate" : "estimated rate"}</div>
        <div className="bg-gray-900 rounded-lg p-3">
          Borrow $X today, repay $Y on {date}. Cost: $Z
        </div>
      </div>

      {/* After-tax sub-section */}
      <div className="border-t">
        <TaxRateInputs ... />
        <div>After-tax effective rate: {afterTaxRate}%</div>
      </div>
    </div>
  </div>

  {/* Order section (full width) */}
  <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
    <h2>Your Order</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <LegTable ... />
      <OrderParams ... />
      <FeeBreakdown ... />
    </div>
  </div>

  {/* Brokerage CTA */}
  <BrokerageCTA selected={selectedBrokerage} onSelect={setSelectedBrokerage} />
  {selectedBrokerage && (
    <BrokerageGuide brokerage={selectedBrokerage} ... />
  )}
</div>
```

**Remove imports:** `RateResult`, `RateBreakdown`, `BorrowSummary`, `OrderSummary`, `PreSubmitChecklist`.
**Keep imports:** `TaxRateInputs`, `Tooltip`.
**Add imports:** `BrokerageCTA`.

**Verify:** `npx tsc --noEmit` passes. `npx vitest run` — all tests pass.

## Step 5: Redirect /order route

**File:** `src/app/order/page.tsx`

Replace entire content:
```typescript
import { redirect } from "next/navigation";
export default function OrderPage() {
  redirect("/");
}
```

**Verify:** `npx next build` passes. `/order` redirects to `/`.

## Step 6: Widen page container

**File:** `src/app/layout.tsx`

Change `max-w-2xl` to `max-w-5xl` (1024px).

**Verify:** Both columns render with adequate width at desktop.

## Step 7: Final verification

- `npx tsc --noEmit` — clean
- `npx vitest run` — all 45 tests pass
- `npx next build` — succeeds
- Desktop: two columns side by side, chart fills left column height
- Mobile (<768px): single column, sections stack
- Click expiration in table → chart dot + calculator update
- Edit mid price → rate recalculates, "est." badge gone, "Reset to estimate" appears
- Change amount → mid price resets to estimate, table rates unchanged
- Order section: 3-column on desktop, single column on mobile
- IBKR button → guide expands inline with checklist
- `/order` → redirects to `/`
